//! Erros da API no formato ApiErrorBody do docs/api-spec.yaml ({code, message}).
//!
//! Só existe o que alguma rota já usa: os erros do sqlx entram quando o
//! /api/v1/investigations passar a ler o PostgreSQL.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    InvalidParameter(String),
    #[error("{0}")]
    NotFound(String),
}

#[derive(Debug, Serialize)]
struct ApiErrorBody {
    code: &'static str,
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            AppError::InvalidParameter(_) => (StatusCode::BAD_REQUEST, "INVALID_PARAMETER"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "NOT_FOUND"),
        };
        let body = ApiErrorBody {
            code,
            message: self.to_string(),
        };
        (status, Json(body)).into_response()
    }
}
