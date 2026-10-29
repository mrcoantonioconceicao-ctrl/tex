use crate::domain::ai::{Summarizer, SyntheticSummarizer};
use crate::simulation::{Simulation, EXPERIMENT_ID};
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub simulation: Mutex<Simulation>,
    pub audit_trail: Mutex<Vec<String>>,
    pub summarizer: Arc<dyn Summarizer>,
    pub start_time: std::time::Instant,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            simulation: Mutex::new(Simulation::default()),
            audit_trail: Mutex::new(Vec::new()),
            summarizer: Arc::new(SyntheticSummarizer::new()),
            start_time: std::time::Instant::now(),
        }
    }

    pub async fn tick(&self) {
        let mut sim = self.simulation.lock().await;
        sim.step();
        let mut trail = self.audit_trail.lock().await;
        trail.push(format!("Tick executed at sequence {}", sim.sequence));
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/v1/health", get(health_handler))
        .route("/api/v1/telemetry/latest", get(telemetry_latest_handler))
        .route("/api/v1/metrics", get(metrics_handler))
        .route("/api/v1/mcp/context", get(mcp_context_handler))
        .route(
            "/api/v1/simulation/suppress",
            post(simulation_suppress_handler),
        )
        .route("/api/v1/simulation/reset", post(simulation_reset_handler))
        .route("/api/v1/ai/summarize", post(summarize_handler))
        .with_state(state)
}

pub fn create_router() -> Router {
    let state = Arc::new(AppState::new());
    router(state)
}

#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub uptime_seconds: u64,
}

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

async fn metrics_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "metrics_version": "v1",
        "status": "operational"
    }))
}

async fn mcp_context_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "context": "MCP Enterprise Server active",
        "mode": "synthetic"
    }))
}

async fn simulation_suppress_handler(State(state): State<Arc<AppState>>) -> Json<Simulation> {
    let mut sim = state.simulation.lock().await;
    sim.suppression_active = true;
    Json(sim.clone())
}

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

async fn summarize_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SummarizeRequest>,
) -> Json<SummarizeResponse> {
    let summary = state.summarizer.summarize(&payload.context);
    Json(SummarizeResponse { summary })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_health_endpoint() {
        let app = create_router();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();
        assert!(body_str.contains("ok"));
        assert!(body_str.contains("uptime_seconds"));
    }

    #[tokio::test]
    async fn test_telemetry_latest_endpoint() {
        let app = create_router();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/telemetry/latest")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();
        assert!(body_str.contains("Synthetic"));
        assert!(body_str.contains(EXPERIMENT_ID));
    }

    #[tokio::test]
    async fn test_ai_summarize_endpoint() {
        let app = create_router();
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/ai/summarize")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"context":"Taxa de queima nominal"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();
        assert!(body_str.contains("[SYNTHETIC AI]"));
    }
}
