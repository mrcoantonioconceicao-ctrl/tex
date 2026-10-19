use axum::{
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time;

#[derive(Serialize, Clone)]
struct TelemetryState {
    temperature: f64,
    oxygen_level: f64,
    flame_propagation: f64,
    risk_level: String,
    suppression_active: bool,
    counter: u64,
}

#[tokio::main]
async fn main() {
    let state = Arc::new(Mutex::new(TelemetryState {
        temperature: 854.5,
        oxygen_level: 21.0,
        flame_propagation: 1.45,
        risk_level: "NOMINAL".to_string(),
        suppression_active: false,
        counter: 0,
    }));

    // Background simulation loop
    let state_clone = Arc::clone(&state);
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            let mut s = state_clone.lock().unwrap();
            s.counter += 1;

            if s.suppression_active {
                // Resfriamento ativo e sufocamento por gás inerte
                s.temperature -= 18.5;
                s.oxygen_level = (s.oxygen_level - 1.2).max(12.0);
                
                if s.temperature <= 870.0 {
                    s.suppression_active = false;
                    s.risk_level = "NOMINAL".to_string();
                } else {
                    s.risk_level = "CRITICAL_SUPPRESSION_ACTIVE".to_string();
                }
            } else {
                if s.counter % 2 == 0 {
                    s.temperature += 12.0;
                } else {
                    s.temperature -= 4.0;
                }
                
                s.oxygen_level = (s.oxygen_level + 0.5).min(21.0);

                if s.temperature > 900.0 {
                    s.suppression_active = true;
                    s.risk_level = "CRITICAL_SUPPRESSION_ACTIVE".to_string();
                } else if s.temperature > 870.0 {
                    s.risk_level = "MODERATE_WARNING".to_string();
                } else {
                    s.risk_level = "NOMINAL".to_string();
                }
            }
        }
    });

    let app = Router::new().route(
        "/telemetry/latest",
        get({
            let state = Arc::clone(&state);
            move || {
                let s = state.lock().unwrap().clone();
                async move { Json(s) }
            }
        }),
    );

    let addr = "0.0.0.0:8080".parse().unwrap();
    println!("Server running on http://0.0.0.0:8080");
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
