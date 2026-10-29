//! Erros da API no formato ApiErrorBody do docs/api-spec.yaml ({code, message}).
//!
//! Só existe o que alguma rota já usa: INVALID_PARAMETER entra com o
//! /api/v1/investigations, junto com o mapeamento dos erros do sqlx.

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
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "NOT_FOUND"),
        };
        let body = ApiErrorBody {
            code,
            message: self.to_string(),
        };
        (status, Json(body)).into_response()
    }
}
