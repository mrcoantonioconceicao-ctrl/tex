use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use sqlx::PgPool;
use crate::domain::ai::summarizer::{Summarizer, SyntheticSummarizer};
use crate::simulation::{Simulation, EXPERIMENT_ID};

#[derive(Clone)]
pub struct AppState {
    pub simulation: Arc<Mutex<Simulation>>,
    pub audit_trail: Arc<Mutex<Vec<String>>>,
    pub summarizer: Arc<dyn Summarizer>,
    pub start_time: std::time::Instant,
    pub db_pool: Option<PgPool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            simulation: Arc::new(Mutex::new(Simulation::default())),
            audit_trail: Arc::new(Mutex::new(Vec::new())),
            summarizer: Arc::new(SyntheticSummarizer::new()),
            start_time: std::time::Instant::now(),
            db_pool: None,
        }
    }
}

impl AppState {
    pub async fn new() -> Self {
        let db_url = std::env::var("DATABASE_URL").ok();
        let db_pool = if let Some(url) = db_url {
            match PgPool::connect(&url).await {
                Ok(pool) => {
                    tracing::info!("Successfully connected to PostgreSQL database.");
                    Some(pool)
                }
                Err(e) => {
                    tracing::error!("Failed to connect to PostgreSQL database: {}. Running without DB.", e);
                    None
                }
            }
        } else {
            tracing::warn!("DATABASE_URL not set. Running app without database persistence.");
            None
        };

        Self {
            simulation: Arc::new(Mutex::new(Simulation::default())),
            audit_trail: Arc::new(Mutex::new(Vec::new())),
            summarizer: Arc::new(SyntheticSummarizer::new()),
            start_time: std::time::Instant::now(),
            db_pool,
        }
    }

    pub async fn tick(&self) {
        let mut sim = self.simulation.lock().await;
        sim.step();
        let mut trail = self.audit_trail.lock().await;
        trail.push(format!("Tick executed at sequence {}", sim.sequence));
    }
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/v1/health", get(health_handler))
        .route("/api/v1/telemetry/latest", get(telemetry_latest_handler))
        .route("/api/v1/metrics", get(metrics_handler))
        .route("/api/v1/mcp/context", get(mcp_context_handler))
        .route("/api/v1/simulation/suppress", post(simulation_suppress_handler))
        .route("/api/v1/simulation/reset", post(simulation_reset_handler))
        .route("/api/v1/ai/summarize", post(summarize_handler))
        .with_state(state)
}

#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub uptime_seconds: u64,
}

#[axum::debug_handler]
async fn health_handler(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        uptime_seconds: state.start_time.elapsed().as_secs(),
    })
}

#[derive(serde::Serialize)]
pub struct TelemetryResponse {
    pub experiment_id: String,
    pub timestamp: String,
    pub temperature_c: f64,
    pub chamber_temperature_c: f64,
    pub oxygen_pct: f64,
    pub oxygen_concentration_pct: f64,
    pub flame_spread_mm_s: f64,
    pub flame_spread_rate_mm_s: f64,
    pub origin_category: String,
    pub sequence: u64,
}

#[axum::debug_handler]
async fn telemetry_latest_handler(State(state): State<Arc<AppState>>) -> Json<TelemetryResponse> {
    let sim = state.simulation.lock().await;
    let now = chrono::Utc::now().to_rfc3339();
    Json(TelemetryResponse {
        experiment_id: EXPERIMENT_ID.to_string(),
        timestamp: now,
        temperature_c: sim.temperature_c,
        chamber_temperature_c: sim.temperature_c,
        oxygen_pct: sim.oxygen_pct,
        oxygen_concentration_pct: sim.oxygen_pct,
        flame_spread_mm_s: sim.flame_spread_mm_s,
        flame_spread_rate_mm_s: sim.flame_spread_mm_s,
        origin_category: "Synthetic".to_string(),
        sequence: sim.sequence,
    })
}

#[axum::debug_handler]
async fn metrics_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "metrics_version": "v1",
        "status": "operational"
    }))
}

#[axum::debug_handler]
async fn mcp_context_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "context": "MCP Enterprise Server active",
        "mode": "synthetic"
    }))
}

#[axum::debug_handler]
async fn simulation_suppress_handler(State(state): State<Arc<AppState>>) -> Json<Simulation> {
    let mut sim = state.simulation.lock().await;
    sim.suppression_active = true;
    Json(sim.clone())
}

#[axum::debug_handler]
async fn simulation_reset_handler(State(state): State<Arc<AppState>>) -> Json<Simulation> {
    let mut sim = state.simulation.lock().await;
    *sim = Simulation::default();
    Json(sim.clone())
}

#[derive(serde::Deserialize)]
pub struct SummarizeRequest {
    pub context: String,
}

#[derive(serde::Serialize)]
pub struct SummarizeResponse {
    pub summary: String,
}

#[axum::debug_handler]
async fn summarize_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SummarizeRequest>,
) -> Json<SummarizeResponse> {
    let summary_obj = state.summarizer.summarize(&payload.context);
    Json(SummarizeResponse { 
        summary: summary_obj.text 
    })
}
