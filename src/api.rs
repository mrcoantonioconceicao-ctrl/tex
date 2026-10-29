use axum::{
    routing::{get, post},
    extract::State,
    Json, Router, http::StatusCode,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::domain::ai::{Summarizer, SyntheticSummarizer};
use crate::simulation::{Simulation, EXPERIMENT_ID};

pub struct AppState {
    pub simulation: Mutex<Simulation>,
    pub audit_trail: Mutex<Vec<String>>,
    pub summarizer: Arc<dyn Summarizer>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            simulation: Mutex::new(Simulation::default()),
            audit_trail: Mutex::new(Vec::new()),
            summarizer: Arc::new(SyntheticSummarizer::new()),
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
        .route("/api/v1/ai/summarize", post(summarize_handler))
        .route("/api/v1/telemetria", get(telemetria_handler))
        .route("/api/v1/tick", post(tick_handler))
        .route("/api/v1/audit", get(audit_handler))
        .route("/api/v1/experiment", get(experiment_handler))
        .with_state(state)
}

pub fn create_router() -> Router {
    let state = Arc::new(AppState::new());
    router(state)
}

async fn health_handler() -> StatusCode {
    StatusCode::OK
}

async fn telemetria_handler(State(state): State<Arc<AppState>>) -> Json<Simulation> {
    let sim = state.simulation.lock().await;
    Json(sim.clone())
}

async fn tick_handler(State(state): State<Arc<AppState>>) -> StatusCode {
    state.tick().await;
    StatusCode::OK
}

async fn audit_handler(State(state): State<Arc<AppState>>) -> Json<Vec<String>> {
    let trail = state.audit_trail.lock().await;
    Json(trail.clone())
}

async fn experiment_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "experiment_id": EXPERIMENT_ID }))
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
                    .body(Body::from(r#"{"context":"Taxa de queima nominal a 500C"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();
        assert!(body_str.contains("[SYNTHETIC AI]"));
    }

    #[tokio::test]
    async fn telemetria_segue_o_contrato_v1() {
        let app = create_router();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/telemetria")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn tick_endpoint_avanca_estado() {
        let app = create_router();
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/tick")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn audit_trail_registra_ticks() {
        let state = Arc::new(AppState::new());
        state.tick().await;
        
        let app = router(state);
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/audit")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();
        assert!(body_str.contains("Tick executed"));
    }

    #[tokio::test]
    async fn experiment_id_retorna_correto() {
        let app = create_router();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/experiment")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();
        assert!(body_str.contains(EXPERIMENT_ID));
    }

    #[tokio::test]
    async fn multiplos_ticks_acumulam_sequencia() {
        let state = Arc::new(AppState::new());
        state.tick().await;
        state.tick().await;
        
        let sim = state.simulation.lock().await;
        assert_eq!(sim.sequence, 2);
    }
}

#[cfg(test)]
mod extra_tests {
    use super::*;

    #[tokio::test]
    async fn test_app_state_default_initialization() {
        let state = AppState::default();
        let sim = state.simulation.lock().await;
        assert_eq!(sim.sequence, 0);
    }
}
