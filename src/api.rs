//! API HTTP v1 (Axum). Contrato documentado em docs/api-spec.yaml.

use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{
    body::Bytes,
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

use crate::catalog_db;
use crate::db::{self, DatabaseStatus};
use crate::domain::ai::summarizer::{Summarizer, SyntheticSummarizer};
use crate::domain::combustion::catalog::{self, Filter};
use crate::domain::combustion::psi_dto::{Investigation, InvestigationPage, Program, ProjectType};
use crate::engine::{
    AstTelemetryParser, AsterEventBus, GraphRAGKnowledgeEngine, McpContextResponse,
    McpEnterpriseServer, Web3AuditSmartContract,
};
use crate::error::AppError;
use crate::lineage::OriginCategory;
use crate::measurements_db::{self, ConditionCoverageList, Envelope, RunPage};
use crate::simulation::{RiskLevel, Simulation, EXPERIMENT_ID};

const DEFAULT_MCP_QUERY: &str = "general_fire_safety";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
/// Front servido pelo nginx (make up) e pelo Vite (make frontend)
pub const DEFAULT_CORS_ORIGINS: &str = "http://localhost:3000,http://localhost:5173";
const DEFAULT_PAGE_SIZE: usize = 20;
const MAX_PAGE_SIZE: usize = 100;
const MAX_QUERY_LENGTH: usize = 200;
/// Até 500 testes por página: um gráfico cabe numa requisição (o SPICE tem 469)
const DEFAULT_RUNS_PAGE_SIZE: usize = 100;
const MAX_RUNS_PAGE_SIZE: usize = 500;

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
    catalog: Catalog,
    /// None = resumo por IA desligado (sem GEMINI_API_KEY com o catálogo do banco): 503
    summarizer: Option<Arc<dyn Summarizer>>,
    /// Resumos Inferred já gerados, por código PSI: o texto da fonte não muda durante
    /// a execução, e a demo não gasta cota do provedor a cada clique
    summaries: Mutex<HashMap<String, AiSummaryResponse>>,
}

/// Fonte do /investigations, escolhida na subida por TEX_CATALOG_SOURCE
pub enum Catalog {
    /// Lista fixa (PSI-9001 a PSI-9006, Synthetic)
    Synthetic(Vec<Investigation>),
    /// experiments/experiment_files, lidos a cada requisição: o que a ingestão
    /// gravar aparece sem reiniciar o backend
    Database(PgPool),
}

impl Catalog {
    async fn load(&self) -> Result<Cow<'_, [Investigation]>, AppError> {
        match self {
            Self::Synthetic(items) => Ok(Cow::Borrowed(items.as_slice())),
            Self::Database(pool) => match catalog_db::load_from_pool(pool).await {
                Ok(items) => Ok(Cow::Owned(items)),
                Err(error) => {
                    tracing::error!(%error, "catálogo indisponível");
                    let message = "catálogo indisponível no momento".to_string();
                    Err(AppError::Unavailable(message))
                }
            },
        }
    }
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
            catalog: Catalog::Synthetic(catalog::synthetic()),
            summarizer: Some(Arc::new(SyntheticSummarizer::new())),
            summaries: Mutex::new(HashMap::new()),
        }
    }
}

impl AppState {
    pub fn new(db: Option<PgPool>, catalog: Catalog) -> Self {
        Self {
            db,
            catalog,
            ..Self::default()
        }
    }

    pub fn with_summarizer(self, summarizer: Option<Arc<dyn Summarizer>>) -> Self {
        Self { summarizer, ..self }
    }

    fn cached_summary(&self, accession: &str) -> Option<AiSummaryResponse> {
        let cache = self.summaries.lock().expect("lock dos resumos envenenado");
        cache.get(accession).cloned()
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

/// AiSummary do contrato
#[derive(Debug, Clone, Serialize)]
pub struct AiSummaryResponse {
    accession: String,
    summary: String,
    source_fields: Vec<&'static str>,
    model: Option<String>,
    generated_at: String,
    origin_category: OriginCategory,
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
    State(state): State<Arc<AppState>>,
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
    let items = state.catalog.load().await?;
    Ok(Json(catalog::search(&items, &filter, page, page_size)))
}

async fn get_investigation(
    State(state): State<Arc<AppState>>,
    Path(raw): Path<String>,
) -> Result<Json<Investigation>, AppError> {
    if !is_valid_accession(&raw) {
        let message = format!("código fora do formato PSI-<número>: {raw}");
        return Err(AppError::InvalidParameter(message));
    }
    let items = state.catalog.load().await?;
    match catalog::find(&items, &raw) {
        Some(investigation) => Ok(Json(investigation)),
        None => {
            let message = format!("investigação {raw} não encontrada");
            Err(AppError::NotFound(message))
        }
    }
}

#[derive(Debug, Deserialize)]
struct SummarizeRequest {
    accession: String,
}

/// Corpo cru: JSON inválido também sai como 400 no formato do contrato
fn parse_summarize_request(body: &[u8]) -> Result<String, AppError> {
    let request: SummarizeRequest = serde_json::from_slice(body).map_err(|_| {
        let message = r#"corpo inválido: esperado {"accession": "PSI-<número>"}"#.to_string();
        AppError::InvalidParameter(message)
    })?;
    if !is_valid_accession(&request.accession) {
        let message = format!("código fora do formato PSI-<número>: {}", request.accession);
        return Err(AppError::InvalidParameter(message));
    }
    Ok(request.accession)
}

/// Só os textos da fonte que existem, cada um com o rótulo; os nomes vão para
/// source_fields (rastreabilidade). None = nada para resumir.
fn summary_context(investigation: &Investigation) -> Option<(String, Vec<&'static str>)> {
    let sections = [
        ("objective", "Objetivo", &investigation.objective),
        ("approach", "Abordagem", &investigation.approach),
        ("hypothesis", "Hipótese", &investigation.hypothesis),
    ];
    let mut context = Vec::new();
    let mut fields = Vec::new();
    for (field, label, text) in sections {
        if let Some(text) = text.as_deref().map(str::trim).filter(|t| !t.is_empty()) {
            context.push(format!("{label}: {text}"));
            fields.push(field);
        }
    }
    (!fields.is_empty()).then(|| (context.join("\n\n"), fields))
}

async fn summarize(
    State(state): State<Arc<AppState>>,
    body: Bytes,
) -> Result<Json<AiSummaryResponse>, AppError> {
    let accession = parse_summarize_request(&body)?;
    if let Some(cached) = state.cached_summary(&accession) {
        return Ok(Json(cached));
    }
    let items = state.catalog.load().await?;
    let investigation = catalog::find(&items, &accession)
        .ok_or_else(|| AppError::NotFound(format!("investigação {accession} não encontrada")))?;
    let (context, source_fields) = summary_context(&investigation).ok_or_else(|| {
        let message = format!("investigação {accession} sem objective, approach nem hypothesis");
        AppError::NoSourceText(message)
    })?;
    let Some(summarizer) = state.summarizer.as_ref() else {
        let message = "resumo por IA desligado: GEMINI_API_KEY não configurada".to_string();
        return Err(AppError::Unavailable(message));
    };
    let summary = summarizer.summarize(&context).await.map_err(|error| {
        // SummarizeError não carrega a chave nem o corpo da resposta do provedor
        tracing::warn!(%error, %accession, "resumo por IA falhou");
        AppError::Unavailable("resumo por IA indisponível no momento".to_string())
    })?;

    let response = AiSummaryResponse {
        accession: accession.clone(),
        summary: summary.text,
        source_fields,
        model: summarizer.model(),
        generated_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        origin_category: summary.origin_category,
    };
    if response.origin_category == OriginCategory::Inferred {
        let mut cache = state.summaries.lock().expect("lock dos resumos envenenado");
        cache.insert(accession, response.clone());
    }
    Ok(Json(response))
}

// ---- Testes, condições e medições (measurements_db.rs) ----

/// Mesma mensagem do catálogo: o detalhe do sqlx fica no log
fn measurements_unavailable(error: impl std::fmt::Display) -> AppError {
    tracing::error!(%error, "medições indisponíveis");
    AppError::Unavailable("catálogo indisponível no momento".to_string())
}

#[derive(Debug, Deserialize)]
struct RunsQuery {
    variable: Option<String>,
    page: Option<String>,
    page_size: Option<String>,
}

/// Nome de variável do contrato: ^[a-z][a-z0-9_]*$
fn parse_variable(raw: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(raw) = raw else { return Ok(None) };
    let mut chars = raw.chars();
    let valid = chars.next().is_some_and(|c| c.is_ascii_lowercase())
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
    if valid {
        Ok(Some(raw.to_string()))
    } else {
        Err(AppError::InvalidParameter(format!(
            "variable fora do formato: {raw}"
        )))
    }
}

async fn list_runs(
    State(state): State<Arc<AppState>>,
    Path(raw): Path<String>,
    Query(query): Query<RunsQuery>,
) -> Result<Json<RunPage>, AppError> {
    if !is_valid_accession(&raw) {
        let message = format!("código fora do formato PSI-<número>: {raw}");
        return Err(AppError::InvalidParameter(message));
    }
    let variable = parse_variable(query.variable.as_deref())?;
    let page = parse_bounded(query.page.as_deref(), "page", 1, usize::MAX)?;
    let page_size = parse_bounded(
        query.page_size.as_deref(),
        "page_size",
        DEFAULT_RUNS_PAGE_SIZE,
        MAX_RUNS_PAGE_SIZE,
    )?;
    let not_found = || AppError::NotFound(format!("investigação {raw} não encontrada"));
    match &state.catalog {
        // Catálogo sintético não tem tabelas normalizadas: lista vazia, nunca teste inventado
        Catalog::Synthetic(items) => catalog::find(items, &raw)
            .map(|_| Json(RunPage::empty(&raw, page, page_size)))
            .ok_or_else(not_found),
        Catalog::Database(pool) => {
            let mut conn = pool.acquire().await.map_err(measurements_unavailable)?;
            measurements_db::load_runs(&mut conn, &raw, variable.as_deref(), page, page_size)
                .await
                .map_err(measurements_unavailable)?
                .map(Json)
                .ok_or_else(not_found)
        }
    }
}

#[derive(Debug, Deserialize)]
struct CoverageQuery {
    o2_min: Option<String>,
    o2_max: Option<String>,
    pressure_min_atm: Option<String>,
    pressure_max_atm: Option<String>,
    flow_min_ms: Option<String>,
    flow_max_ms: Option<String>,
}

/// Número opcional que passa no limite do contrato; ausente é None
fn parse_limit(
    raw: Option<&str>,
    name: &str,
    valid: fn(f64) -> bool,
) -> Result<Option<f64>, AppError> {
    match raw.map(str::parse::<f64>) {
        None => Ok(None),
        Some(Ok(value)) if value.is_finite() && valid(value) => Ok(Some(value)),
        Some(_) => Err(AppError::InvalidParameter(format!(
            "{name} fora do limite do contrato"
        ))),
    }
}

fn parse_envelope(query: &CoverageQuery) -> Result<Envelope, AppError> {
    let percent = |v: f64| (0.0..=100.0).contains(&v);
    let positive = |v: f64| v > 0.0;
    let non_negative = |v: f64| v >= 0.0;
    let envelope = Envelope {
        o2_min: parse_limit(query.o2_min.as_deref(), "o2_min", percent)?,
        o2_max: parse_limit(query.o2_max.as_deref(), "o2_max", percent)?,
        pressure_min_atm: parse_limit(
            query.pressure_min_atm.as_deref(),
            "pressure_min_atm",
            positive,
        )?,
        pressure_max_atm: parse_limit(
            query.pressure_max_atm.as_deref(),
            "pressure_max_atm",
            positive,
        )?,
        flow_min_ms: parse_limit(query.flow_min_ms.as_deref(), "flow_min_ms", non_negative)?,
        flow_max_ms: parse_limit(query.flow_max_ms.as_deref(), "flow_max_ms", non_negative)?,
    };
    let pairs = [
        ("o2", envelope.o2_min, envelope.o2_max),
        (
            "pressure",
            envelope.pressure_min_atm,
            envelope.pressure_max_atm,
        ),
        ("flow", envelope.flow_min_ms, envelope.flow_max_ms),
    ];
    for (name, min, max) in pairs {
        if let (Some(min), Some(max)) = (min, max) {
            if min > max {
                let message = format!("{name}: mínimo maior que o máximo");
                return Err(AppError::InvalidParameter(message));
            }
        }
    }
    Ok(envelope)
}

async fn condition_coverage(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CoverageQuery>,
) -> Result<Json<ConditionCoverageList>, AppError> {
    let envelope = parse_envelope(&query)?;
    match &state.catalog {
        Catalog::Synthetic(_) => Ok(Json(ConditionCoverageList { items: Vec::new() })),
        Catalog::Database(pool) => {
            let mut conn = pool.acquire().await.map_err(measurements_unavailable)?;
            measurements_db::load_coverage(&mut conn, &envelope)
                .await
                .map(Json)
                .map_err(measurements_unavailable)
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
        .route("/investigations/:accession", get(get_investigation))
        .route("/investigations/:accession/runs", get(list_runs))
        .route("/conditions/coverage", get(condition_coverage))
        .route("/ai/summarize", post(summarize));

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
        let synthetic = Catalog::Synthetic(catalog::synthetic());
        let state = Arc::new(AppState::new(Some(pool), synthetic));
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
    async fn tick_avanca_a_leitura() {
        let state = new_state();
        state.tick();
        let (_, body) = call(&state, "GET", "/api/v1/telemetry/latest", None).await;
        assert_eq!(body["sequence"], 1);
        assert_eq!(body["chamber_temperature_c"], 850.5);
    }

    #[tokio::test]
    async fn metricas_tem_os_campos_que_o_front_valida() {
        let (status, body) = call(&new_state(), "GET", "/api/v1/metrics", None).await;
        assert_eq!(status, StatusCode::OK);
        for field in [
            "system_target",
            "ast_parsing_latency_us",
            "graphrag_query_latency_us",
            "token_crusher_efficiency_pct",
            "memory_safety_guarantee",
            "uptime_status",
        ] {
            assert!(!body[field].is_null(), "campo ausente: {field}");
        }
    }

    #[tokio::test]
    async fn mcp_devolve_contexto_e_atualiza_as_metricas() {
        let state = new_state();
        let (status, body) = call(
            &state,
            "POST",
            "/api/v1/mcp/context",
            Some(json!({ "query": "oxigênio" })),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(body["compressed_context"]
            .as_str()
            .unwrap()
            .contains("oxigênio"));
        assert_eq!(body["protocol"], "MCP-Enterprise-v1");
        assert_eq!(body["origin_category"], "Synthetic");

        let (_, metrics) = call(&state, "GET", "/api/v1/metrics", None).await;
        assert!(metrics["token_crusher_efficiency_pct"].as_f64().unwrap() > 0.0);
    }

    #[tokio::test]
    async fn mcp_usa_consulta_padrao_quando_vazia() {
        let (_, body) = call(
            &new_state(),
            "POST",
            "/api/v1/mcp/context",
            Some(json!({ "query": "  " })),
        )
        .await;
        assert!(body["compressed_context"]
            .as_str()
            .unwrap()
            .contains(DEFAULT_MCP_QUERY));
    }

    #[tokio::test]
    async fn supressao_manual_e_reset() {
        let state = new_state();
        let (status, body) = call(&state, "POST", "/api/v1/simulation/suppress", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["suppression_active"], true);
        assert_eq!(body["risk_level"], "CRITICAL_SUPPRESSION_ACTIVE");

        state.tick();
        let (_, body) = call(&state, "POST", "/api/v1/simulation/reset", None).await;
        assert_eq!(body["sequence"], 0);
        assert_eq!(body["risk_level"], "NOMINAL");
        assert_eq!(body["suppression_active"], false);
    }

    #[tokio::test]
    async fn investigations_lista_o_catalogo_sintetico() {
        let (status, body) = call(&new_state(), "GET", "/api/v1/investigations", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["total"], 6);
        assert_eq!(body["page"], 1);
        assert_eq!(body["page_size"], 20);
        let items = body["items"].as_array().unwrap();
        assert_eq!(items.len(), 6);
        assert_eq!(items[0]["accession"], "PSI-9001");
        assert_eq!(items[0]["origin_category"], "Synthetic");
        // O resumo não leva os campos do detalhe
        assert!(items[0].get("files").is_none());
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
        let (_, body) = call(&state, "GET", uri, None).await;
        assert_eq!(body["total"], 6);
        assert_eq!(body["items"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn investigations_rejeita_parametros_fora_do_contrato() {
        let long_query = format!("q={}", "a".repeat(MAX_QUERY_LENGTH + 1));
        let cases = [
            "program=flex",
            "project_type=Lunar",
            "q=",
            "page=0",
            "page=abc",
            "page_size=0",
            "page_size=101",
            long_query.as_str(),
        ];
        let state = new_state();
        for case in cases {
            let uri = format!("/api/v1/investigations?{case}");
            let (status, body) = call(&state, "GET", &uri, None).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "{case}");
            assert_eq!(body["code"], "INVALID_PARAMETER", "{case}");
        }
    }

    #[tokio::test]
    async fn investigation_detalhe_e_erros_do_contrato() {
        let state = new_state();
        let (status, body) = call(&state, "GET", "/api/v1/investigations/PSI-9003", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["accession"], "PSI-9003");
        assert_eq!(body["files"].as_array().unwrap().len(), 2);
        assert_eq!(body["total_file_bytes"], 3072);
        assert_eq!(body["origin_category"], "Synthetic");

        let (status, body) = call(&state, "GET", "/api/v1/investigations/9003", None).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["code"], "INVALID_PARAMETER");

        let (status, body) = call(&state, "GET", "/api/v1/investigations/PSI-1", None).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["code"], "NOT_FOUND");
    }

    #[tokio::test]
    async fn investigations_com_o_banco_fora_do_ar_devolve_503() {
        // Porta 1: ninguém escuta; o detalhe do sqlx fica no log, não na resposta
        let pool = sqlx::postgres::PgPoolOptions::new()
            .acquire_timeout(Duration::from_millis(500))
            .connect_lazy("postgres://tex:tex@127.0.0.1:1/tex")
            .unwrap();
        let state = Arc::new(AppState::new(None, Catalog::Database(pool)));
        for uri in ["/api/v1/investigations", "/api/v1/investigations/PSI-1"] {
            let (status, body) = call(&state, "GET", uri, None).await;
            assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{uri}");
            assert_eq!(body["code"], "SERVICE_UNAVAILABLE", "{uri}");
            assert_eq!(body["message"], "catálogo indisponível no momento");
        }
    }

    #[tokio::test]
    async fn investigations_usa_o_catalogo_do_estado() {
        let state = Arc::new(AppState::new(None, Catalog::Synthetic(Vec::new())));
        let (status, body) = call(&state, "GET", "/api/v1/investigations", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["total"], 0);

        let uri = "/api/v1/investigations/PSI-9001";
        let (status, _) = call(&state, "GET", uri, None).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    // ---- POST /ai/summarize ----

    use crate::domain::ai::summarizer::{SummarizeError, Summary};
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Provedor falso que se comporta como o real (Inferred) e conta as chamadas
    #[derive(Default)]
    struct FakeModel {
        calls: AtomicUsize,
    }

    #[async_trait::async_trait]
    impl Summarizer for FakeModel {
        async fn summarize(&self, context: &str) -> Result<Summary, SummarizeError> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            Ok(Summary {
                text: format!("resumo de: {context}"),
                origin_category: OriginCategory::Inferred,
            })
        }

        fn model(&self) -> Option<String> {
            Some("modelo-teste".to_string())
        }
    }

    struct FailingModel;

    #[async_trait::async_trait]
    impl Summarizer for FailingModel {
        async fn summarize(&self, _context: &str) -> Result<Summary, SummarizeError> {
            Err(SummarizeError::Status(429))
        }
    }

    async fn summarize_call(state: &Arc<AppState>, body: Value) -> (StatusCode, Value) {
        call(state, "POST", "/api/v1/ai/summarize", Some(body)).await
    }

    #[tokio::test]
    async fn resumo_sintetico_segue_o_contrato() {
        let (status, body) = summarize_call(&new_state(), json!({ "accession": "PSI-9001" })).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["accession"], "PSI-9001");
        assert_eq!(body["origin_category"], "Synthetic");
        assert_eq!(body["model"], Value::Null);
        assert_eq!(body["source_fields"], json!(["objective"]));
        assert!(body["summary"]
            .as_str()
            .unwrap()
            .contains("Objetivo sintético"));
        assert!(body["generated_at"].as_str().unwrap().ends_with('Z'));
    }

    #[tokio::test]
    async fn resumo_do_modelo_sai_inferred_com_o_modelo_e_vai_para_o_cache() {
        let model = Arc::new(FakeModel::default());
        let summarizer: Arc<dyn Summarizer> = model.clone();
        let state = Arc::new(AppState::default().with_summarizer(Some(summarizer)));
        let request = json!({ "accession": "PSI-9002" });

        let (status, first) = summarize_call(&state, request.clone()).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(first["origin_category"], "Inferred");
        assert_eq!(first["model"], "modelo-teste");

        let (_, second) = summarize_call(&state, request).await;
        assert_eq!(second, first);
        assert_eq!(model.calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn resumo_rejeita_corpo_e_codigo_invalidos() {
        let state = new_state();
        for body in [
            json!({}),
            json!({ "accession": 25 }),
            json!({ "accession": "25" }),
        ] {
            let (status, reply) = summarize_call(&state, body.clone()).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
            assert_eq!(reply["code"], "INVALID_PARAMETER", "{body}");
        }
        // JSON quebrado também sai no formato do contrato
        let reply = request(&state, "POST", "/api/v1/ai/summarize", &[], None).await;
        assert_eq!(reply.status, StatusCode::BAD_REQUEST);
        assert_eq!(reply.body["code"], "INVALID_PARAMETER");
    }

    #[tokio::test]
    async fn resumo_de_codigo_inexistente_devolve_404() {
        let (status, body) = summarize_call(&new_state(), json!({ "accession": "PSI-1" })).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["code"], "NOT_FOUND");
    }

    #[tokio::test]
    async fn resumo_sem_texto_da_fonte_devolve_422() {
        let mut items = catalog::synthetic();
        items[0].objective = None;
        let state = Arc::new(AppState::new(None, Catalog::Synthetic(items)));
        let (status, body) = summarize_call(&state, json!({ "accession": "PSI-9001" })).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(body["code"], "NO_SOURCE_TEXT");
    }

    #[tokio::test]
    async fn resumo_sem_provedor_ou_com_falha_devolve_503_generico() {
        let off = Arc::new(AppState::default().with_summarizer(None));
        let (status, body) = summarize_call(&off, json!({ "accession": "PSI-9001" })).await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body["code"], "SERVICE_UNAVAILABLE");

        let failing: Arc<dyn Summarizer> = Arc::new(FailingModel);
        let state = Arc::new(AppState::default().with_summarizer(Some(failing)));
        let (status, body) = summarize_call(&state, json!({ "accession": "PSI-9001" })).await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body["message"], "resumo por IA indisponível no momento");
    }

    #[test]
    fn contexto_junta_so_os_textos_que_existem() {
        let mut investigation = catalog::synthetic().remove(0);
        investigation.objective = Some(" Medir a extinção. ".to_string());
        investigation.approach = Some("   ".to_string());
        investigation.hypothesis = Some("A chama encolhe.".to_string());
        let (context, fields) = summary_context(&investigation).unwrap();
        assert_eq!(fields, vec!["objective", "hypothesis"]);
        assert_eq!(
            context,
            "Objetivo: Medir a extinção.\n\nHipótese: A chama encolhe."
        );
    }

    // ---- GET /investigations/{accession}/runs e /conditions/coverage ----

    #[tokio::test]
    async fn runs_no_catalogo_sintetico_e_vazio_e_nunca_inventado() {
        let state = new_state();
        let uri = "/api/v1/investigations/PSI-9001/runs";
        let (status, body) = call(&state, "GET", uri, None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["accession"], "PSI-9001");
        assert_eq!(body["total"], 0);
        assert_eq!(body["page"], 1);
        assert_eq!(body["page_size"], 100);
        assert_eq!(body["items"], json!([]));
        assert_eq!(body["variables"], json!([]));

        let (status, body) = call(&state, "GET", "/api/v1/investigations/PSI-1/runs", None).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["code"], "NOT_FOUND");
    }

    #[tokio::test]
    async fn runs_rejeita_parametros_fora_do_contrato() {
        let state = new_state();
        let cases = [
            "/api/v1/investigations/9001/runs",
            "/api/v1/investigations/PSI-9001/runs?variable=O2",
            "/api/v1/investigations/PSI-9001/runs?variable=o2-final",
            "/api/v1/investigations/PSI-9001/runs?page=0",
            "/api/v1/investigations/PSI-9001/runs?page_size=501",
        ];
        for uri in cases {
            let (status, body) = call(&state, "GET", uri, None).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "{uri}");
            assert_eq!(body["code"], "INVALID_PARAMETER", "{uri}");
        }
    }

    #[tokio::test]
    async fn cobertura_no_catalogo_sintetico_e_lista_vazia() {
        let uri = "/api/v1/conditions/coverage?o2_min=30&pressure_max_atm=0.694";
        let (status, body) = call(&new_state(), "GET", uri, None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body, json!({ "items": [] }));
    }

    #[tokio::test]
    async fn cobertura_rejeita_envelope_invalido() {
        let state = new_state();
        let cases = [
            "o2_min=abc",
            "o2_min=101",
            "o2_min=40&o2_max=30",
            "pressure_max_atm=0",
            "pressure_min_atm=1&pressure_max_atm=0.5",
            "flow_min_ms=-1",
            "o2_max=NaN",
        ];
        for case in cases {
            let uri = format!("/api/v1/conditions/coverage?{case}");
            let (status, body) = call(&state, "GET", &uri, None).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "{case}");
            assert_eq!(body["code"], "INVALID_PARAMETER", "{case}");
        }
    }

    #[tokio::test]
    async fn medicoes_com_o_banco_fora_do_ar_devolvem_503() {
        // Porta 1: ninguém escuta; o detalhe do sqlx fica no log, não na resposta
        let pool = sqlx::postgres::PgPoolOptions::new()
            .acquire_timeout(Duration::from_millis(500))
            .connect_lazy("postgres://tex:tex@127.0.0.1:1/tex")
            .unwrap();
        let state = Arc::new(AppState::new(None, Catalog::Database(pool)));
        for uri in [
            "/api/v1/investigations/PSI-25/runs",
            "/api/v1/conditions/coverage",
        ] {
            let (status, body) = call(&state, "GET", uri, None).await;
            assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{uri}");
            assert_eq!(body["message"], "catálogo indisponível no momento", "{uri}");
        }
    }
}
