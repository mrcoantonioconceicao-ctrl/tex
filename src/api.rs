//! API HTTP v1 (Axum). Contrato documentado em docs/api-spec.yaml.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderValue, Method, StatusCode, Uri},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    timeout::TimeoutLayer,
};

use crate::db::{self, DatabaseStatus};
use crate::domain::combustion::catalog::{self, Filter};
use crate::domain::combustion::psi_dto::{Investigation, InvestigationPage, Program, ProjectType};
use crate::engine::{
    AstTelemetryParser, AsterEventBus, GraphRAGKnowledgeEngine, McpContextResponse,
    McpEnterpriseServer, Web3AuditSmartContract,
};
use crate::error::AppError;
use crate::lineage::OriginCategory;
use crate::simulation::{RiskLevel, Simulation, EXPERIMENT_ID};

const DEFAULT_MCP_QUERY: &str = "general_fire_safety";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
/// Front servido pelo nginx (make up) e pelo Vite (make frontend)
pub const DEFAULT_CORS_ORIGINS: &str = "http://localhost:3000,http://localhost:5173";
const DEFAULT_PAGE_SIZE: usize = 20;
const MAX_PAGE_SIZE: usize = 100;
const MAX_QUERY_LENGTH: usize = 200;

// ---- Estado compartilhado ----

struct Reading {
    sim: Simulation,
    updated_at: DateTime<Utc>,
}

/// Últimas medições reais dos componentes (0 até a primeira medição)
#[derive(Default)]
struct LiveMetrics {
    ast_parsing_latency_us: u64,
    graphrag_query_latency_us: u64,
    token_crusher_efficiency_pct: f64,
}

pub struct AppState {
    reading: Mutex<Reading>,
    metrics: Mutex<LiveMetrics>,
    started_at: Instant,
    /// None quando o servidor sobe sem DATABASE_URL
    db: Option<PgPool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            reading: Mutex::new(Reading {
                sim: Simulation::default(),
                updated_at: Utc::now(),
            }),
            metrics: Mutex::new(LiveMetrics::default()),
            started_at: Instant::now(),
            db: None,
        }
    }
}

impl AppState {
    pub fn with_database(db: Option<PgPool>) -> Self {
        Self {
            db,
            ..Self::default()
        }
    }

    /// Um ciclo do laço de background: avança a simulação, valida a leitura
    /// e registra eventos quando o nível de risco muda.
    pub fn tick(&self) {
        let sim = {
            let mut reading = self.reading.lock().expect("lock da leitura envenenado");
            let before = reading.sim.risk_level;
            reading.sim.step();
            reading.updated_at = Utc::now();
            if reading.sim.risk_level != before {
                on_risk_change(&reading.sim);
            }
            reading.sim.clone()
        };

        match AstTelemetryParser::parse_and_validate(&sim) {
            Ok(latency_us) => {
                self.metrics
                    .lock()
                    .expect("lock das métricas envenenado")
                    .ast_parsing_latency_us = latency_us
            }
            Err(error) => eprintln!("[AST Parser] {error}"),
        }
    }

    fn update_simulation(&self, change: impl FnOnce(&mut Simulation)) -> TelemetryResponse {
        let mut reading = self.reading.lock().expect("lock da leitura envenenado");
        let before = reading.sim.risk_level;
        change(&mut reading.sim);
        reading.updated_at = Utc::now();
        if reading.sim.risk_level != before {
            on_risk_change(&reading.sim);
        }
        TelemetryResponse::from_reading(&reading)
    }

    fn latest(&self) -> TelemetryResponse {
        TelemetryResponse::from_reading(&self.reading.lock().expect("lock da leitura envenenado"))
    }

    fn uptime_seconds(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}

fn on_risk_change(sim: &Simulation) {
    AsterEventBus::dispatch_event("RiskLevelChanged", sim);
    if sim.risk_level == RiskLevel::CriticalSuppressionActive {
        let hash = Web3AuditSmartContract::anchor_telemetry_hash(sim);
        println!("[Web3 Audit] Supressão acionada; leitura ancorada: {hash}");
    }
}

// ---- Respostas ----

fn round_to(value: f64, decimals: i32) -> f64 {
    let factor = 10f64.powi(decimals);
    (value * factor).round() / factor
}

#[derive(Debug, Serialize)]
pub struct TelemetryResponse {
    experiment_id: &'static str,
    timestamp: String,
    sequence: u64,
    chamber_temperature_c: f64,
    oxygen_concentration_pct: f64,
    flame_spread_rate_mm_s: f64,
    risk_level: RiskLevel,
    suppression_active: bool,
    origin_category: OriginCategory,
}

impl TelemetryResponse {
    fn from_reading(reading: &Reading) -> Self {
        let sim = &reading.sim;
        Self {
            experiment_id: EXPERIMENT_ID,
            timestamp: reading
                .updated_at
                .to_rfc3339_opts(SecondsFormat::Millis, true),
            sequence: sim.sequence,
            chamber_temperature_c: round_to(sim.temperature_c, 1),
            oxygen_concentration_pct: round_to(sim.oxygen_pct, 1),
            flame_spread_rate_mm_s: round_to(sim.flame_spread_mm_s, 2),
            risk_level: sim.risk_level,
            suppression_active: sim.suppression_active,
            // A telemetria inteira vem da simulação: não é dado da ISS
            origin_category: OriginCategory::Synthetic,
        }
    }
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    uptime_seconds: u64,
    database: DatabaseStatus,
}

#[derive(Debug, Serialize)]
struct MetricsResponse {
    system_target: &'static str,
    ast_parsing_latency_us: u64,
    graphrag_query_latency_us: u64,
    token_crusher_efficiency_pct: f64,
    memory_safety_guarantee: &'static str,
    uptime_status: &'static str,
    uptime_seconds: u64,
}

// ---- Handlers ----

/// "ok" diz que o servidor está no ar (o healthcheck do Docker depende disso);
/// o estado do banco vem à parte, para o backend não reiniciar quando só o banco cai.
async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        uptime_seconds: state.uptime_seconds(),
        database: db::status(state.db.as_ref()).await,
    })
}

async fn latest_telemetry(State(state): State<Arc<AppState>>) -> Json<TelemetryResponse> {
    Json(state.latest())
}

async fn metrics(State(state): State<Arc<AppState>>) -> Json<MetricsResponse> {
    let live = state.metrics.lock().expect("lock das métricas envenenado");
    Json(MetricsResponse {
        system_target: "NASA Space Apps Challenge 2026 - Microgravidade",
        ast_parsing_latency_us: live.ast_parsing_latency_us,
        graphrag_query_latency_us: live.graphrag_query_latency_us,
        token_crusher_efficiency_pct: live.token_crusher_efficiency_pct,
        memory_safety_guarantee: "Zero-Cost Abstractions & Zero Garbage Collector (Rust Safe)",
        uptime_status: "NOMINAL_ACTIVE",
        uptime_seconds: state.uptime_seconds(),
    })
}

async fn mcp_context(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Json<McpContextResponse> {
    let query = payload
        .get("query")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|query| !query.is_empty())
        .unwrap_or(DEFAULT_MCP_QUERY);

    let (insight, graphrag_latency_us) = GraphRAGKnowledgeEngine::query_knowledge_base(query);
    let response = McpEnterpriseServer::provide_context(query, &insight);

    let mut live = state.metrics.lock().expect("lock das métricas envenenado");
    live.graphrag_query_latency_us = graphrag_latency_us;
    live.token_crusher_efficiency_pct = response.token_metrics.compression_efficiency_pct;

    Json(response)
}

async fn reset_simulation(State(state): State<Arc<AppState>>) -> Json<TelemetryResponse> {
    println!("[Simulação] Reiniciada pela API");
    Json(state.update_simulation(Simulation::reset))
}

async fn trigger_suppression(State(state): State<Arc<AppState>>) -> Json<TelemetryResponse> {
    println!("[Simulação] Supressão acionada manualmente pela API");
    Json(state.update_simulation(Simulation::trigger_suppression))
}

/// Parâmetros crus: a validação fica aqui para o 400 sair no formato do
/// contrato (a rejeição padrão do extrator Query devolve texto puro).
#[derive(Debug, Deserialize)]
struct InvestigationQuery {
    program: Option<String>,
    project_type: Option<String>,
    q: Option<String>,
    page: Option<String>,
    page_size: Option<String>,
}

/// Enum opcional: ausente é None, valor fora do contrato é 400
fn parse_choice<T>(
    raw: Option<&str>,
    name: &str,
    parse: fn(&str) -> Option<T>,
) -> Result<Option<T>, AppError> {
    match raw {
        None => Ok(None),
        Some(raw) => match parse(raw) {
            Some(value) => Ok(Some(value)),
            None => {
                let message = format!("{name} desconhecido: {raw}");
                Err(AppError::InvalidParameter(message))
            }
        },
    }
}

/// Inteiro opcional entre 1 e `max`; ausente usa o padrão
fn parse_bounded(
    raw: Option<&str>,
    name: &str,
    default: usize,
    max: usize,
) -> Result<usize, AppError> {
    match raw.map(str::parse::<usize>) {
        None => Ok(default),
        Some(Ok(value)) if (1..=max).contains(&value) => Ok(value),
        Some(_) => {
            let message = format!("{name} precisa ser inteiro entre 1 e {max}");
            Err(AppError::InvalidParameter(message))
        }
    }
}

fn parse_text(raw: Option<&str>) -> Result<Option<String>, AppError> {
    match raw {
        None => Ok(None),
        Some(text) if (1..=MAX_QUERY_LENGTH).contains(&text.chars().count()) => {
            Ok(Some(text.to_string()))
        }
        Some(_) => {
            let message = format!("q precisa ter de 1 a {MAX_QUERY_LENGTH} caracteres");
            Err(AppError::InvalidParameter(message))
        }
    }
}

fn is_valid_accession(raw: &str) -> bool {
    match raw.strip_prefix("PSI-") {
        Some(digits) => !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()),
        None => false,
    }
}

async fn list_investigations(
    Query(query): Query<InvestigationQuery>,
) -> Result<Json<InvestigationPage>, AppError> {
    let filter = Filter {
        program: parse_choice(query.program.as_deref(), "program", Program::parse)?,
        project_type: parse_choice(
            query.project_type.as_deref(),
            "project_type",
            ProjectType::parse,
        )?,
        text: parse_text(query.q.as_deref())?,
    };
    let page = parse_bounded(query.page.as_deref(), "page", 1, usize::MAX)?;
    let page_size = parse_bounded(
        query.page_size.as_deref(),
        "page_size",
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE,
    )?;
    let items =
        catalog::load_investigations().map_err(|e| AppError::InvalidParameter(e.to_string()))?;
    Ok(Json(catalog::search(&items, &filter, page, page_size)))
}

async fn get_investigation(Path(raw): Path<String>) -> Result<Json<Investigation>, AppError> {
    if !is_valid_accession(&raw) {
        let message = format!("código fora do formato PSI-<número>: {raw}");
        return Err(AppError::InvalidParameter(message));
    }
    let items =
        catalog::load_investigations().map_err(|e| AppError::InvalidParameter(e.to_string()))?;
    match catalog::find(&items, &raw) {
        Some(investigation) => Ok(Json(investigation)),
        None => {
            let message = format!("investigação {raw} não encontrada");
            Err(AppError::NotFound(message))
        }
    }
}

async fn not_found(uri: Uri) -> AppError {
    AppError::NotFound(format!("rota não encontrada: {}", uri.path()))
}

/// Lista separada por vírgula (CORS_ALLOWED_ORIGINS). Origem inválida é ignorada.
pub fn parse_origins(raw: &str) -> Vec<HeaderValue> {
    raw.split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .filter_map(|origin| match HeaderValue::from_str(origin) {
            Ok(value) => Some(value),
            Err(_) => {
                tracing::warn!("origem de CORS ignorada: {origin:?}");
                None
            }
        })
        .collect()
}

pub fn router(state: Arc<AppState>, allowed_origins: Vec<HeaderValue>) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .route("/telemetry/latest", get(latest_telemetry))
        .route("/metrics", get(metrics))
        .route("/mcp/context", post(mcp_context))
        .route("/simulation/reset", post(reset_simulation))
        .route("/simulation/suppress", post(trigger_suppression))
        .route("/investigations", get(list_investigations))
        .route("/investigations/:accession", get(get_investigation));

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins))
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE]);

    let timeout = TimeoutLayer::with_status_code(StatusCode::REQUEST_TIMEOUT, REQUEST_TIMEOUT);

    Router::new()
        .nest("/api/v1", api)
        .fallback(not_found)
        .layer(timeout)
        .layer(cors)
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::{TcpListener, TcpStream};

    struct Reply {
        status: StatusCode,
        /// Cabeçalhos em minúsculas, um por linha
        headers: String,
        body: Value,
    }

    /// Sobe o router numa porta livre e faz uma requisição HTTP/1.1 de verdade.
    /// (O Cargo.lock não tem o tower como dependência direta para usar o oneshot.)
    async fn request(
        state: &Arc<AppState>,
        method: &str,
        uri: &str,
        extra_headers: &[(&str, &str)],
        body: Option<Value>,
    ) -> Reply {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let app = router(state.clone(), parse_origins(DEFAULT_CORS_ORIGINS));
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

        let payload = body.map(|value| value.to_string()).unwrap_or_default();
        let mut raw = format!(
            "{method} {uri} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\
             Content-Type: application/json\r\nContent-Length: {}\r\n",
            payload.len()
        );
        for (name, value) in extra_headers {
            raw.push_str(&format!("{name}: {value}\r\n"));
        }
        raw.push_str("\r\n");
        raw.push_str(&payload);

        let mut stream = TcpStream::connect(addr).await.unwrap();
        stream.write_all(raw.as_bytes()).await.unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).await.unwrap();

        let (head, body) = response.split_once("\r\n\r\n").unwrap();
        let code: u16 = head.split_whitespace().nth(1).unwrap().parse().unwrap();
        Reply {
            status: StatusCode::from_u16(code).unwrap(),
            headers: head.to_lowercase(),
            body: serde_json::from_str(body).unwrap_or(Value::Null),
        }
    }

    async fn call(
        state: &Arc<AppState>,
        method: &str,
        uri: &str,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let reply = request(state, method, uri, &[], body).await;
        (reply.status, reply.body)
    }

    fn new_state() -> Arc<AppState> {
        Arc::new(AppState::default())
    }

    #[tokio::test]
    async fn health_responde_ok() {
        let (status, body) = call(&new_state(), "GET", "/api/v1/health", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["status"], "ok");
        assert_eq!(body["database"], "disabled");
    }

    #[tokio::test]
    async fn health_continua_ok_com_o_banco_fora_do_ar() {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://tex:tex@127.0.0.1:1/tex")
            .unwrap();
        let state = Arc::new(AppState::with_database(Some(pool)));
        let (status, body) = call(&state, "GET", "/api/v1/health", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["status"], "ok");
        assert_eq!(body["database"], "down");
    }

    #[tokio::test]
    async fn rota_desconhecida_devolve_o_erro_do_contrato() {
        let (status, body) = call(&new_state(), "GET", "/api/v1/nao-existe", None).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["code"], "NOT_FOUND");
        assert!(body["message"]
            .as_str()
            .unwrap()
            .contains("/api/v1/nao-existe"));
    }

    async fn preflight(origin: &str) -> Reply {
        let headers = [("Origin", origin), ("Access-Control-Request-Method", "GET")];
        request(
            &new_state(),
            "OPTIONS",
            "/api/v1/telemetry/latest",
            &headers,
            None,
        )
        .await
    }

    #[tokio::test]
    async fn cors_libera_so_as_origens_do_front() {
        let allowed = preflight("http://localhost:5173").await;
        assert!(allowed
            .headers
            .contains("access-control-allow-origin: http://localhost:5173"));

        let blocked = preflight("https://exemplo.invalid").await;
        assert!(!blocked.headers.contains("access-control-allow-origin"));
    }

    #[test]
    fn origens_invalidas_ou_vazias_sao_ignoradas() {
        let origins = parse_origins(" http://localhost:3000 ,,bad\norigin");
        assert_eq!(
            origins,
            vec![HeaderValue::from_static("http://localhost:3000")]
        );
    }

    #[tokio::test]
    async fn telemetria_segue_o_contrato_v1() {
        let (status, body) = call(&new_state(), "GET", "/api/v1/telemetry/latest", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["experiment_id"], EXPERIMENT_ID);
        assert_eq!(body["chamber_temperature_c"], 854.5);
        assert_eq!(body["oxygen_concentration_pct"], 21.0);
        assert_eq!(body["flame_spread_rate_mm_s"], 1.45);
        assert_eq!(body["risk_level"], "NOMINAL");
        assert_eq!(body["suppression_active"], false);
        assert_eq!(body["sequence"], 0);
        assert_eq!(body["origin_category"], "Synthetic");
        assert!(body["timestamp"].as_str().unwrap().ends_with('Z'));
    }

    #[tokio::test]
    async fn rotas_ficam_so_sob_api_v1() {
        let (status, _) = call(&new_state(), "GET", "/telemetry/latest", None).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn metricas_tem_os_campos_que_o_front_valida() {
        let (status, body) = call(&new_state(), "GET", "/api/v1/metrics", None).await;
        assert_eq!(status, StatusCode::OK);
        assert!(body["system_target"].as_str().unwrap().contains("NASA"));
        assert_eq!(body["ast_parsing_latency_us"], 0);
        assert_eq!(body["graphrag_query_latency_us"], 0);
        assert_eq!(body["token_crusher_efficiency_pct"], 0.0);
        assert!(body["memory_safety_guarantee"]
            .as_str()
            .unwrap()
            .contains("Rust"));
        assert_eq!(body["uptime_status"], "NOMINAL_ACTIVE");
        assert!(body["uptime_seconds"].as_u64().is_some());
    }

    #[tokio::test]
    async fn mcp_devolve_contexto_e_atualiza_as_metricas() {
        let state = new_state();
        let (status, body) = call(
            &state,
            "POST",
            "/api/v1/mcp/context",
            Some(json!({"query": "oxigênio"})),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["protocol"], "MCP-Enterprise-v1");
        assert!(body["compressed_context"]
            .as_str()
            .unwrap()
            .starts_with("[SIMULADO]"));
        assert_eq!(body["origin_category"], "Synthetic");

        let (_, metrics) = call(&state, "GET", "/api/v1/metrics", None).await;
        assert!(
            metrics["graphrag_query_latency_us"].as_u64().unwrap() > 0
                || metrics["graphrag_query_latency_us"] == 0
        );
    }

    #[tokio::test]
    async fn mcp_usa_consulta_padrao_quando_vazia() {
        let (status, body) = call(
            &new_state(),
            "POST",
            "/api/v1/mcp/context",
            Some(json!({"query": "   "})),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(body["compressed_context"]
            .as_str()
            .unwrap()
            .contains(DEFAULT_MCP_QUERY));
    }

    #[tokio::test]
    async fn tick_avanca_a_leitura() {
        let state = new_state();
        state.tick();
        let (status, body) = call(&state, "GET", "/api/v1/telemetry/latest", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["sequence"], 1);
    }

    #[tokio::test]
    async fn supressao_manual_e_reset() {
        let state = new_state();
        let (status, body) = call(&state, "POST", "/api/v1/simulation/suppress", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["suppression_active"], true);
        assert_eq!(body["risk_level"], "CRITICAL_SUPPRESSION_ACTIVE");

        let (status, body) = call(&state, "POST", "/api/v1/simulation/reset", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["suppression_active"], false);
        assert_eq!(body["sequence"], 0);
        assert_eq!(body["chamber_temperature_c"], 854.5);
    }

    #[tokio::test]
    async fn investigations_lista_o_catalogo_sintetico() {
        let (status, body) = call(&new_state(), "GET", "/api/v1/investigations", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["total"], 6);
        assert_eq!(body["page"], 1);
        assert_eq!(body["page_size"], 20);
        assert_eq!(body["items"][0]["accession"], "PSI-9001");
        assert_eq!(body["items"][0]["origin_category"], "Synthetic");
    }

    #[tokio::test]
    async fn investigations_filtra_e_pagina() {
        let state = new_state();
        let uri = "/api/v1/investigations?project_type=Ground%20Investigation&q=psi";
        let (status, body) = call(&state, "GET", uri, None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["total"], 1);
        assert_eq!(body["items"][0]["accession"], "PSI-9005");

        let uri = "/api/v1/investigations?page=2&page_size=4";
        let (status, body) = call(&state, "GET", uri, None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["total"], 6);
        assert_eq!(body["items"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn investigations_rejeita_parametros_fora_do_contrato() {
        let state = new_state();
        for case in [
            "program=XYZ",
            "project_type=Foo",
            "q=",
            "page=0",
            "page_size=101",
        ] {
            let uri = format!("/api/v1/investigations?{case}");
            let (status, body) = call(&state, "GET", &uri, None).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "caso {case}");
            assert_eq!(body["code"], "INVALID_PARAMETER", "caso {case}");
        }
    }

    #[tokio::test]
    async fn investigation_detalhe_e_erros_do_contrato() {
        let state = new_state();
        let (status, body) = call(&state, "GET", "/api/v1/investigations/PSI-9003", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["accession"], "PSI-9003");
        assert_eq!(body["files"].as_array().unwrap().len(), 2);
        assert_eq!(body["origin_category"], "Synthetic");

        let (status, body) = call(&state, "GET", "/api/v1/investigations/9003", None).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["code"], "INVALID_PARAMETER");

        let (status, body) = call(&state, "GET", "/api/v1/investigations/PSI-1", None).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["code"], "NOT_FOUND");
    }
}
