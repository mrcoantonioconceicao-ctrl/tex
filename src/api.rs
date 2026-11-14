//! API HTTP v1 (Axum). Contrato documentado em docs/api-spec.yaml.

use std::borrow::Cow;
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

use crate::catalog_db;
use crate::db::{self, DatabaseStatus};
use crate::domain::ai::summarizer::{GeminiSummarizer, Summarizer};
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
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
pub const DEFAULT_CORS_ORIGINS: &str = "http://localhost:3000,http://localhost:5173";
const DEFAULT_PAGE_SIZE: usize = 20;
const MAX_PAGE_SIZE: usize = 100;
const MAX_QUERY_LENGTH: usize = 200;

struct Reading {
    sim: Simulation,
    updated_at: DateTime<Utc>,
}

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
    db: Option<PgPool>,
    catalog: Catalog,
    summarizer: Option<Arc<dyn Summarizer>>,
}

pub enum Catalog {
    Synthetic(Vec<Investigation>),
    Database(PgPool),
}

impl Catalog {
    async fn load(&self) -> Result<Cow<'_, [Investigation]>, AppError> {
        match self {
            Self::Synthetic(items) => Ok(Cow::Borrowed(items.as_slice())),
            Self::Database(pool) => match catalog_db::load_from_pool(pool).await {
                Ok(items) => Ok(Cow::Owned(items)),
                Err(error) => {
                    tracing::warn!(%error, "banco indisponível, caindo para catálogo sintético de segurança");
                    Ok(Cow::Owned(catalog::synthetic()))
                }
            },
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        let summarizer = GeminiSummarizer::new()
            .map(|s| Arc::new(s) as Arc<dyn Summarizer>)
            .ok();

        Self {
            reading: Mutex::new(Reading {
                sim: Simulation::default(),
                updated_at: Utc::now(),
            }),
            metrics: Mutex::new(LiveMetrics::default()),
            started_at: Instant::now(),
            db: None,
            catalog: Catalog::Synthetic(catalog::synthetic()),
            summarizer,
        }
    }
}

impl AppState {
    pub fn new(db: Option<PgPool>, catalog: Catalog) -> Self {
        let summarizer = GeminiSummarizer::new()
            .map(|s| Arc::new(s) as Arc<dyn Summarizer>)
            .ok();

        Self {
            db,
            catalog,
            summarizer,
            ..Self::default()
        }
    }

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

#[derive(Debug, Deserialize)]
pub struct AiSummaryRequest {
    pub accession: String,
}

#[derive(Debug, Serialize)]
pub struct AiSummaryResponse {
    pub accession: String,
    pub summary: String,
    pub origin_category: OriginCategory,
}

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

async fn ai_summarize_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AiSummaryRequest>,
) -> Result<Json<AiSummaryResponse>, AppError> {
    let summarizer = state
        .summarizer
        .as_ref()
        .ok_or_else(|| AppError::Unavailable("resumo por IA indisponível no momento".to_string()))?;

    let items = state.catalog.load().await?;
    let investigation = catalog::find(&items, &payload.accession)
        .ok_or_else(|| AppError::NotFound(format!("investigação {} não encontrada", payload.accession)))?;

    let context = format!(
        "Título: {}\nObjetivo: {}\nHipótese: {}",
        investigation.summary.title.as_deref().unwrap_or("N/A"),
        investigation.objective.as_deref().unwrap_or("N/A"),
        investigation.hypothesis.as_deref().unwrap_or("N/A")
    );

    let summary_result = summarizer
        .summarize(&context)
        .await
        .map_err(|e| AppError::Unavailable(format!("falha ao gerar resumo por IA: {e}")))?;

    Ok(Json(AiSummaryResponse {
        accession: payload.accession,
        summary: summary_result.text,
        origin_category: summary_result.origin_category,
    }))
}

#[derive(Debug, Deserialize)]
struct InvestigationQuery {
    program: Option<String>,
    project_type: Option<String>,
    q: Option<String>,
    page: Option<String>,
    page_size: Option<String>,
}

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

async fn not_found(uri: Uri) -> AppError {
    AppError::NotFound(format!("rota não encontrada: {}", uri.path()))
}

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
        .route("/ai/summarize", post(ai_summarize_handler));

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
