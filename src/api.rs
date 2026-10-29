use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use sqlx::PgPool;
use std::sync::Arc;

use crate::domain::combustion::{
    Investigation, InvestigationFile, InvestigationPage, InvestigationSummary, Program, ProjectType,
};
use crate::lineage::OriginCategory;
use crate::error::AppError;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: Option<PgPool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self { db_pool: None }
    }
}

const DEFAULT_PAGE_SIZE: u32 = 20;
const MAX_PAGE_SIZE: u32 = 100;
const MAX_QUERY_LENGTH: usize = 200;

fn is_valid_accession(s: &str) -> bool {
    match s.strip_prefix("PSI-") {
        Some(rest) if !rest.is_empty() => rest.chars().all(|c| c.is_ascii_digit()),
        _ => false,
    }
}

fn synthetic_investigations() -> Vec<Investigation> {
    vec![
        Investigation {
            summary: InvestigationSummary {
                accession: "PSI-9001".to_string(),
                name: "FLEX-2".to_string(),
                title: Some("Investigação sintética FLEX-2".to_string()),
                program: Program::FLEX,
                project_type: Some(ProjectType::MicrogravityInvestigation),
                sub_research_area: Some("Combustion".to_string()),
                hardware: vec!["Combustion Integrated Rack (CIR)".to_string()],
                start_date: Some("2026-01-01".to_string()),
                end_date: Some("2026-01-31".to_string()),
                file_count: 1,
                origin_category: OriginCategory::Synthetic,
            },
            psi_version: Some(1),
            objective: Some("Objetivo sintético de FLEX-2.".to_string()),
            approach: Some("Abordagem experimental padrão.".to_string()),
            hypothesis: Some("Hipótese validada sinteticamente.".to_string()),
            doi: Some("10.1000/psi.9001".to_string()),
            license: Some("CC0-1.0".to_string()),
            total_file_bytes: Some(1024),
            files: vec![InvestigationFile {
                category: "Experimental table".to_string(),
                file_name: "flex2_data.csv".to_string(),
                file_bytes: Some(1024),
                sha256: None,
                downloaded_at: None,
            }],
            ingested_at: Some("2026-10-28T12:00:00.000Z".to_string()),
        },
        Investigation {
            summary: InvestigationSummary {
                accession: "PSI-9002".to_string(),
                name: "BASS-II".to_string(),
                title: Some("Investigação sintética BASS-II".to_string()),
                program: Program::BASS,
                project_type: Some(ProjectType::MicrogravityInvestigation),
                sub_research_area: Some("Combustion".to_string()),
                hardware: vec!["Combustion Integrated Rack (CIR)".to_string()],
                start_date: Some("2026-02-01".to_string()),
                end_date: Some("2026-02-28".to_string()),
                file_count: 1,
                origin_category: OriginCategory::Synthetic,
            },
            psi_version: Some(1),
            objective: Some("Objetivo sintético de BASS-II.".to_string()),
            approach: Some("Abordagem experimental padrão.".to_string()),
            hypothesis: Some("Hipótese validada sinteticamente.".to_string()),
            doi: Some("10.1000/psi.9002".to_string()),
            license: Some("CC0-1.0".to_string()),
            total_file_bytes: Some(2048),
            files: vec![InvestigationFile {
                category: "Experimental table".to_string(),
                file_name: "bass2_data.csv".to_string(),
                file_bytes: Some(2048),
                sha256: None,
                downloaded_at: None,
            }],
            ingested_at: Some("2026-10-28T12:00:00.000Z".to_string()),
        },
        Investigation {
            summary: InvestigationSummary {
                accession: "PSI-9003".to_string(),
                name: "ACME BRE".to_string(),
                title: Some("Investigação sintética ACME BRE".to_string()),
                program: Program::ACME,
                project_type: Some(ProjectType::MicrogravityInvestigation),
                sub_research_area: Some("Combustion".to_string()),
                hardware: vec!["Combustion Integrated Rack (CIR)".to_string()],
                start_date: Some("2026-03-01".to_string()),
                end_date: Some("2026-03-31".to_string()),
                file_count: 2,
                origin_category: OriginCategory::Synthetic,
            },
            psi_version: Some(1),
            objective: Some("Objetivo sintético de ACME BRE.".to_string()),
            approach: Some("Abordagem experimental avançada.".to_string()),
            hypothesis: Some("Hipótese multi-arquivo.".to_string()),
            doi: Some("10.1000/psi.9003".to_string()),
            license: Some("CC0-1.0".to_string()),
            total_file_bytes: Some(3072),
            files: vec![
                InvestigationFile {
                    category: "Experimental table".to_string(),
                    file_name: "acme_1.csv".to_string(),
                    file_bytes: Some(1536),
                    sha256: None,
                    downloaded_at: None,
                },
                InvestigationFile {
                    category: "Experimental table".to_string(),
                    file_name: "acme_2.csv".to_string(),
                    file_bytes: Some(1536),
                    sha256: None,
                    downloaded_at: None,
                },
            ],
            ingested_at: Some("2026-10-28T12:00:00.000Z".to_string()),
        },
        Investigation {
            summary: InvestigationSummary {
                accession: "PSI-9004".to_string(),
                name: "SAFFIRE-II".to_string(),
                title: Some("Investigação sintética SAFFIRE-II".to_string()),
                program: Program::Saffire,
                project_type: Some(ProjectType::MicrogravityInvestigation),
                sub_research_area: Some("Combustion".to_string()),
                hardware: vec!["Combustion Integrated Rack (CIR)".to_string()],
                start_date: Some("2026-04-01".to_string()),
                end_date: Some("2026-04-30".to_string()),
                file_count: 1,
                origin_category: OriginCategory::Synthetic,
            },
            psi_version: Some(1),
            objective: Some("Objetivo sintético de SAFFIRE-II.".to_string()),
            approach: Some("Abordagem remota.".to_string()),
            hypothesis: Some("Segurança em câmara.".to_string()),
            doi: Some("10.1000/psi.9004".to_string()),
            license: Some("CC0-1.0".to_string()),
            total_file_bytes: Some(512),
            files: vec![InvestigationFile {
                category: "Experimental table".to_string(),
                file_name: "saffire2.csv".to_string(),
                file_bytes: Some(512),
                sha256: None,
                downloaded_at: None,
            }],
            ingested_at: Some("2026-10-28T12:00:00.000Z".to_string()),
        },
        Investigation {
            summary: InvestigationSummary {
                accession: "PSI-9005".to_string(),
                name: "PSI-9005".to_string(),
                title: Some("Investigação sintética PSI-9005".to_string()),
                program: Program::Other,
                project_type: Some(ProjectType::GroundInvestigation),
                sub_research_area: Some("Ground Tests".to_string()),
                hardware: vec![],
                start_date: Some("2026-05-01".to_string()),
                end_date: Some("2026-05-31".to_string()),
                file_count: 0,
                origin_category: OriginCategory::Synthetic,
            },
            psi_version: Some(1),
            objective: Some("Objetivo sintético solo.".to_string()),
            approach: Some("Ground test approach.".to_string()),
            hypothesis: Some("Ground hypothesis.".to_string()),
            doi: Some("10.1000/psi.9005".to_string()),
            license: Some("CC0-1.0".to_string()),
            total_file_bytes: Some(0),
            files: vec![],
            ingested_at: Some("2026-10-28T12:00:00.000Z".to_string()),
        },
        Investigation {
            summary: InvestigationSummary {
                accession: "PSI-9006".to_string(),
                name: "SAME-R".to_string(),
                title: Some("Investigação sintética SAME-R".to_string()),
                program: Program::SAME,
                project_type: None,
                sub_research_area: Some("General".to_string()),
                hardware: vec![],
                start_date: Some("2026-06-01".to_string()),
                end_date: Some("2026-06-30".to_string()),
                file_count: 1,
                origin_category: OriginCategory::Synthetic,
            },
            psi_version: Some(1),
            objective: Some("Objetivo sintético SAME-R.".to_string()),
            approach: Some("Approach SAME.".to_string()),
            hypothesis: Some("Hypothesis SAME.".to_string()),
            doi: Some("10.1000/psi.9006".to_string()),
            license: Some("CC0-1.0".to_string()),
            total_file_bytes: Some(128),
            files: vec![InvestigationFile {
                category: "Experimental table".to_string(),
                file_name: "samer.csv".to_string(),
                file_bytes: Some(128),
                sha256: None,
                downloaded_at: None,
            }],
            ingested_at: Some("2026-10-28T12:00:00.000Z".to_string()),
        },
    ]
}

#[derive(Deserialize)]
struct InvestigationQuery {
    program: Option<String>,
    project_type: Option<String>,
    q: Option<String>,
    page: Option<String>,
    page_size: Option<String>,
}

#[axum::debug_handler]
async fn list_investigations(
    Query(query): Query<InvestigationQuery>,
) -> Result<Json<InvestigationPage>, AppError> {
    let filter_program = if let Some(ref p) = query.program {
        Some(Program::parse(p).ok_or_else(|| AppError::InvalidParameter(format!("Invalid program: {}", p)))?)
    } else {
        None
    };

    let filter_project_type = if let Some(ref pt) = query.project_type {
        Some(ProjectType::parse(pt).ok_or_else(|| AppError::InvalidParameter(format!("Invalid project_type: {}", pt)))?)
    } else {
        None
    };

    let search_q = if let Some(ref q_str) = query.q {
        if q_str.trim().is_empty() || q_str.len() > MAX_QUERY_LENGTH {
            return Err(AppError::InvalidParameter("Query parameter 'q' is empty or exceeds max length".to_string()));
        }
        Some(q_str.to_lowercase())
    } else {
        None
    };

    let page = if let Some(ref p_str) = query.page {
        let p: u32 = p_str.parse().map_err(|_| AppError::InvalidParameter("Invalid page number".to_string()))?;
        if p == 0 { return Err(AppError::InvalidParameter("Page must be >= 1".to_string())); }
        p
    } else {
        1
    };

    let page_size = if let Some(ref ps_str) = query.page_size {
        let ps: u32 = ps_str.parse().map_err(|_| AppError::InvalidParameter("Invalid page_size".to_string()))?;
        if ps == 0 || ps > MAX_PAGE_SIZE {
            return Err(AppError::InvalidParameter(format!("page_size must be between 1 and {}", MAX_PAGE_SIZE)));
        }
        ps
    } else {
        DEFAULT_PAGE_SIZE
    };

    let all_invs = synthetic_investigations();

    let filtered: Vec<InvestigationSummary> = all_invs
        .into_iter()
        .map(|inv| inv.summary)
        .filter(|sum| {
            if let Some(ref fp) = filter_program {
                if &sum.program != fp {
                    return false;
                }
            }
            if let Some(ref fpt) = filter_project_type {
                if sum.project_type.as_ref() != Some(fpt) {
                    return false;
                }
            }
            if let Some(ref sq) = search_q {
                let match_acc = sum.accession.to_lowercase().contains(sq);
                let match_name = sum.name.to_lowercase().contains(sq);
                let match_title = sum.title.as_deref().unwrap_or("").to_lowercase().contains(sq);
                if !match_acc && !match_name && !match_title {
                    return false;
                }
            }
            true
        })
        .collect();

    let total = filtered.len() as u32;
    let start = ((page - 1) * page_size) as usize;
    
    let items = if start >= filtered.len() {
        vec![]
    } else {
        filtered.into_iter().skip(start).take(page_size as usize).collect()
    };

    Ok(Json(InvestigationPage {
        items,
        total,
        page,
        page_size,
    }))
}

#[axum::debug_handler]
async fn get_investigation_detail(
    Path(accession): Path<String>,
) -> Result<Json<Investigation>, AppError> {
    if !is_valid_accession(&accession) {
        return Err(AppError::InvalidParameter(format!("Invalid accession format: {}", accession)));
    }

    let all_invs = synthetic_investigations();
    let inv = all_invs
        .into_iter()
        .find(|i| i.summary.accession == accession)
        .ok_or_else(|| AppError::NotFound(format!("Investigation not found: {}", accession)))?;

    Ok(Json(inv))
}

#[axum::debug_handler]
async fn health_check(State(state): State<Arc<AppState>>) -> impl axum::response::IntoResponse {
    let db_status = if let Some(pool) = &state.db_pool {
        match sqlx::query("SELECT 1").execute(pool).await {
            Ok(_) => "connected",
            Err(_) => "error",
        }
    } else {
        "disabled"
    };

    Json(serde_json::json!({
        "status": "healthy",
        "database": db_status
    }))
}

#[axum::debug_handler]
async fn simulate_chamber() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "simulation_ok",
        "message": "Chamber simulation completed successfully."
    }))
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/simulate", get(simulate_chamber))
        .route("/investigations", get(list_investigations))
        .route("/investigations/:accession", get(get_investigation_detail))
        .with_state(state)
    }

pub fn router(state: Arc<AppState>) -> Router {
    create_router(state)
}
