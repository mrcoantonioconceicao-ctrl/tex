//! API HTTP v1 (Axum). Contrato documentado em docs/api-spec.yaml.

use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, SecondsFormat, Utc};
use serde::Serialize;

use crate::engine::{
    AstTelemetryParser, AsterEventBus, GraphRAGKnowledgeEngine, McpContextResponse,
    McpEnterpriseServer, Web3AuditSmartContract,
};
use crate::lineage::OriginCategory;
use crate::simulation::{RiskLevel, Simulation, EXPERIMENT_ID};

const DEFAULT_MCP_QUERY: &str = "general_fire_safety";

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
        }
    }
}

impl AppState {
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

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        uptime_seconds: state.uptime_seconds(),
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

pub fn router(state: Arc<AppState>) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .route("/telemetry/latest", get(latest_telemetry))
        .route("/metrics", get(metrics))
        .route("/mcp/context", post(mcp_context))
        .route("/simulation/reset", post(reset_simulation))
        .route("/simulation/suppress", post(trigger_suppression));

    Router::new().nest("/api/v1", api).with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{header, Request, StatusCode};
    use serde_json::{json, Value};
    use tower::ServiceExt;

    async fn call(
        state: &Arc<AppState>,
        method: &str,
        uri: &str,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let mut request = Request::builder().method(method).uri(uri);
        let body = match body {
            Some(payload) => {
                request = request.header(header::CONTENT_TYPE, "application/json");
                Body::from(payload.to_string())
            }
            None => Body::empty(),
        };
        let response = router(state.clone())
            .oneshot(request.body(body).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        (
            status,
            serde_json::from_slice(&bytes).unwrap_or(Value::Null),
        )
    }

    fn new_state() -> Arc<AppState> {
        Arc::new(AppState::default())
    }

    #[tokio::test]
    async fn health_responde_ok() {
        let (status, body) = call(&new_state(), "GET", "/api/v1/health", None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["status"], "ok");
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
}
