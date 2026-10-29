use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal server error: {0}")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    code: String,
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, error_message) = match &self {
            AppError::Database(err) => {
                tracing::error!("Database error occurred: {}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR".to_string(), "Database operation failed".to_string())
            }
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND".to_string(), msg.clone()),
            AppError::InvalidParameter(msg) => (StatusCode::BAD_REQUEST, "INVALID_PARAMETER".to_string(), msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "BAD_REQUEST".to_string(), msg.clone()),
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR".to_string(), msg.clone())
            }
        };

        let body = Json(ErrorResponse {
            code,
            message: error_message,
        });

        (status, body).into_response()
    }
}
