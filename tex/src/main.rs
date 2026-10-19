use axum::{
    routing::{get, post},
    Json, Router,
};
use tower_http::cors::CorsLayer;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Mutex;
use std::time::Instant;
use tokio::time::{sleep, Duration};

#[allow(dead_code)]
struct AppState {
    telemetry: Mutex<CombustionTelemetry>,
    boot_time: Instant,
}

#[derive(Serialize, Deserialize, Clone)]
struct CombustionTelemetry {
    experiment_id: String,
    chamber_temperature_c: f64,
    oxygen_concentration_pct: u32,
    flame_spread_rate_mm_s: f64,
    risk_level: String,
    deterministic_guard_status: String,
}

#[derive(Deserialize)]
struct McpQuery {
    query: String,
}

#[derive(Serialize)]
struct TokenMetrics {
    original_estimated_tokens: usize,
    compressed_tokens: usize,
    compression_efficiency_pct: u32,
}

#[derive(Serialize)]
struct McpContextResponse {
    protocol: String,
    status: String,
    compressed_context: String,
    deterministic_action_enforced: String,
    token_metrics: TokenMetrics,
}

#[tokio::main]
async fn main() {
    println!("==================================================");
    println!("        TEX LABS - SPACE APPS 2026                ");
    println!(" Microgravity Fire Safety & Deterministic Guards  ");
    println!("==================================================");

    let telemetry_state = std::sync::Arc::new(Mutex::new(CombustionTelemetry {
        experiment_id: "NASA-ISS-CIR-042".to_string(),
        chamber_temperature_c: 850.0,
        oxygen_concentration_pct: 21,
        flame_spread_rate_mm_s: 1.25,
        risk_level: "MODERATE_WARNING".to_string(),
        deterministic_guard_status: "MONITORING_ACTIVE".to_string(),
    }));

    let loop_state = telemetry_state.clone();
    tokio::spawn(async move {
        let mut temp = 850.0;
        loop {
            sleep(Duration::from_secs(5)).await;
            temp += 12.0;
            if temp > 1300.0 {
                temp = 830.0;
            }

            let mut state = loop_state.lock().unwrap();
            state.chamber_temperature_c = temp;

            if temp > 900.0 {
                state.oxygen_concentration_pct = 12;
                state.risk_level = "CRITICAL_SUPPRESSION_ACTIVE".to_string();
                state.deterministic_guard_status = "GUARD_ENFORCED: O2_ISOLATED & N2_INJECTED".to_string();
            } else {
                state.oxygen_concentration_pct = 21;
                state.risk_level = "MODERATE_WARNING".to_string();
                state.deterministic_guard_status = "MONITORING_ACTIVE: NOMINAL_FLOW".to_string();
            }
        }
    });

    let app_state = std::sync::Arc::new(AppState {
        telemetry: Mutex::new(CombustionTelemetry {
            experiment_id: "NASA-ISS-CIR-042".to_string(),
            chamber_temperature_c: 850.0,
            oxygen_concentration_pct: 21,
            flame_spread_rate_mm_s: 1.25,
            risk_level: "MODERATE_WARNING".to_string(),
            deterministic_guard_status: "MONITORING_ACTIVE".to_string(),
        }),
        boot_time: Instant::now(),
    });

    // CORS permissivo e compatível com tower-http v0.7
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/telemetry/latest", get(get_telemetry))
        .route("/mcp/context", post(post_mcp_context))
        .layer(cors)
        .with_state(app_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!("[v] Servidor Axum com Guards Determinísticos pronto em http://127.0.0.1:8080");
    
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn get_telemetry(
    axum::extract::State(state): axum::extract::State<std::sync::Arc<AppState>>,
) -> Json<CombustionTelemetry> {
    let telemetry = state.telemetry.lock().unwrap().clone();
    Json(telemetry)
}

async fn post_mcp_context(Json(payload): Json<McpQuery>) -> Json<McpContextResponse> {
    let response = provide_context(&payload.query);
    Json(response)
}

fn provide_context(query: &str) -> McpContextResponse {
    let q = query.to_lowercase();
    let (raw_knowledge, action, original_tokens) = if q.contains("oxygen") || q.contains("oxigenio") || q.contains("supressao") {
        (
            "ALERTA ISS: Parâmetros de câmara indicam limiar de combustão avançada. Protocolo de salvaguarda ativado pelo kernel em Rust.".to_string(),
            "Válvulas de oxigénio isoladas deterministicamente e injeção de azoto acionada.".to_string(),
            35
        )
    } else if q.contains("temperatura") || q.contains("temp") {
        (
            "ANOMALIA TÉRMICA: Registo acima dos limites nominais na câmara CIR-042. Refrigeração autónoma em curso.".to_string(),
            "Monitorização estrita de propagação de chama ativa.".to_string(),
            32
        )
    } else {
        (
            format!("CONSULTA GRAPH-RAG para '{}': Sistema a operar sob diretrizes da NASA-ISS-CIR-042.", query),
            "Nenhuma ação corretiva crítica pendente.".to_string(),
            24
        )
    };

    let compressed_tokens = (raw_knowledge.split_whitespace().count() as f32 * 0.85) as usize;
    McpContextResponse {
        protocol: "MCP-Deterministic-Guards-v1".to_string(),
        status: "SECURE_ENFORCED".to_string(),
        compressed_context: raw_knowledge,
        deterministic_action_enforced: action,
        token_metrics: TokenMetrics {
            original_estimated_tokens: original_tokens,
            compressed_tokens,
            compression_efficiency_pct: 15,
        },
    }
}
