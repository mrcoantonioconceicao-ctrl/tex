//! Tex Labs: backend Axum do NASA Space Apps Challenge 2026 (Free-Fall Flame).
//!
//! main.rs só inicia o servidor. Simulação em simulation.rs, componentes do
//! pipeline em engine.rs e rotas HTTP em api.rs (contrato em docs/api-spec.yaml).

mod api;
mod catalog_db;
mod db;
// O catálogo do PSI já serve o /api/v1/investigations; o Summarizer e a ponte
// GraphRAG ainda não têm rota no docs/api-spec.yaml (mesmo caso de lineage.rs).
#[allow(dead_code)]
mod domain;
mod engine;
mod error;
mod lineage;
mod simulation;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use api::{AppState, Catalog};
use domain::combustion::catalog::{self, CatalogSource};
use sqlx::PgPool;
use tokio::net::TcpListener;

const TICK_INTERVAL: Duration = Duration::from_secs(5);
const CONFIG_PATH: &str = "config/system.json";
const DEFAULT_PORT: u16 = 8080;

#[tokio::main]
async fn main() {
    // .env opcional para rodar fora do Docker (modelo em .env.example)
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    println!("==================================================");
    println!("         TEX LABS - SPACE APPS 2026               ");
    println!("  Microgravity Fire Safety & GraphRAG Engine      ");
    println!("==================================================");
    print_config();

    let pool = db::pool_from_env();
    let catalog = select_catalog(pool.clone());
    let state = Arc::new(AppState::new(pool, catalog));

    // Laço de simulação: um ciclo a cada 5 s
    let ticker = Arc::clone(&state);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(TICK_INTERVAL);
        interval.tick().await; // o primeiro tick é imediato; a leitura inicial vale um ciclo inteiro
        loop {
            interval.tick().await;
            ticker.tick();
        }
    });

    let port = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_PORT);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Servidor em http://{addr} (rotas em /api/v1)");

    let listener = TcpListener::bind(addr)
        .await
        .expect("falha ao abrir a porta do servidor");
    let cors_origins = std::env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| api::DEFAULT_CORS_ORIGINS.to_string());
    let app = api::router(state, api::parse_origins(&cors_origins));
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("falha no servidor HTTP");
}

/// Mostra o projeto e os domínios do config/system.json. Sem o arquivo o
/// servidor continua: ele não altera o comportamento da API.
fn print_config() {
    let config = std::fs::read_to_string(CONFIG_PATH)
        .map_err(|error| error.to_string())
        .and_then(|raw| {
            serde_json::from_str::<serde_json::Value>(&raw).map_err(|error| error.to_string())
        });

    match config {
        Ok(config) => {
            println!(
                "[✔] Projeto: {}",
                config["project"].as_str().unwrap_or("(sem nome)")
            );
            println!("[i] Domínios DDD: {}", config["architecture"]["domains"]);
        }
        Err(error) => eprintln!("[!] {CONFIG_PATH} não carregado ({error}); seguindo sem ele"),
    }
}

/// Fonte do /api/v1/investigations (TEX_CATALOG_SOURCE). Configuração
/// inválida encerra aqui, antes de abrir a porta, em vez de virar erro por requisição.
fn select_catalog(pool: Option<PgPool>) -> Catalog {
    let selected = match CatalogSource::from_env() {
        Ok(CatalogSource::Synthetic) => Ok(Catalog::Synthetic(catalog::synthetic())),
        Ok(CatalogSource::Database) => pool
            .map(Catalog::Database)
            .ok_or_else(|| "TEX_CATALOG_SOURCE=database exige DATABASE_URL".to_string()),
        Err(error) => Err(error.to_string()),
    };
    match selected {
        Ok(source) => source,
        Err(message) => {
            eprintln!("[x] {message}");
            std::process::exit(1);
        }
    }
}

/// Ctrl+C ou SIGTERM (docker stop): encerra respondendo as requisições em andamento
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("falha ao escutar Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("falha ao escutar SIGTERM")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    println!("Encerrando o servidor...");
}
