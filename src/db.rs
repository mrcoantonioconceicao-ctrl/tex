//! Conexão com o PostgreSQL (o mesmo banco das migrações em ingestion/).
//!
//! O banco é opcional: sem DATABASE_URL o servidor sobe só com a simulação.
//! O pool conecta sob demanda, então o backend não depende da ordem de
//! subida no docker-compose; o /health mostra se o banco responde.

use std::time::Duration;

use serde::Serialize;
use sqlx::postgres::{PgPool, PgPoolOptions};

const MAX_CONNECTIONS: u32 = 5;
const ACQUIRE_TIMEOUT: Duration = Duration::from_secs(3);
const PING_TIMEOUT: Duration = Duration::from_secs(2);

/// Lê DATABASE_URL e monta o pool. A URL tem senha: nunca vai para o log.
pub fn pool_from_env() -> Option<PgPool> {
    let url = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.trim().is_empty() => url,
        _ => {
            tracing::warn!("DATABASE_URL não definida; seguindo sem banco");
            return None;
        }
    };

    let pool = PgPoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .acquire_timeout(ACQUIRE_TIMEOUT)
        .connect_lazy(&url);
    match pool {
        Ok(pool) => Some(pool),
        Err(error) => {
            tracing::error!(%error, "DATABASE_URL inválida; seguindo sem banco");
            None
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseStatus {
    Up,
    Down,
    /// Servidor sem DATABASE_URL
    Disabled,
}

pub async fn status(pool: Option<&PgPool>) -> DatabaseStatus {
    let Some(pool) = pool else {
        return DatabaseStatus::Disabled;
    };

    let ping = sqlx::query("SELECT 1").execute(pool);
    match tokio::time::timeout(PING_TIMEOUT, ping).await {
        Ok(Ok(_)) => DatabaseStatus::Up,
        Ok(Err(error)) => {
            tracing::warn!(%error, "banco não respondeu");
            DatabaseStatus::Down
        }
        Err(_) => {
            tracing::warn!("banco não respondeu em {PING_TIMEOUT:?}");
            DatabaseStatus::Down
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn sem_pool_o_banco_fica_desligado() {
        assert_eq!(status(None).await, DatabaseStatus::Disabled);
    }

    #[tokio::test]
    async fn banco_inacessivel_aparece_como_fora_do_ar() {
        // Porta 1: ninguém escuta, a conexão é recusada
        let pool = PgPoolOptions::new()
            .connect_lazy("postgres://tex:tex@127.0.0.1:1/tex")
            .unwrap();
        assert_eq!(status(Some(&pool)).await, DatabaseStatus::Down);
    }

    #[test]
    fn status_serializa_no_formato_da_api() {
        let json = |s: DatabaseStatus| serde_json::to_string(&s).unwrap();
        assert_eq!(json(DatabaseStatus::Up), "\"up\"");
        assert_eq!(json(DatabaseStatus::Down), "\"down\"");
        assert_eq!(json(DatabaseStatus::Disabled), "\"disabled\"");
    }
}
