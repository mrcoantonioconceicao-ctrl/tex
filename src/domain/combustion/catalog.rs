//! Catálogo de investigações do PSI: filtro, busca e paginação.
//!
//! Até 14/11 a fonte padrão é o catálogo SINTÉTICO abaixo, igual ao do MSW
//! (frontend/src/mocks/investigations.ts). Códigos PSI-9xxx não existem no PSI.
//!
//! A variável TEX_CATALOG_SOURCE escolhe a fonte, lida uma vez na subida do
//! servidor (main.rs): valor inválido ou fonte ainda não implementada impedem
//! a subida, então as rotas nunca falham por configuração.
//! - synthetic (padrão): lista fixa marcada como Synthetic
//! - database: ainda não implementado (não finge ler o Postgres)

use thiserror::Error;

use crate::lineage::OriginCategory;

use super::psi_dto::{
    Investigation, InvestigationFile, InvestigationPage, InvestigationSummary, Program, ProjectType,
};

const SYNTHETIC_INGESTED_AT: &str = "2026-10-28T12:00:00.000Z";
const SYNTHETIC_FILE_BYTES: u64 = 1024;
const SOURCE_VAR: &str = "TEX_CATALOG_SOURCE";

/// Fonte do catálogo (TEX_CATALOG_SOURCE)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CatalogSource {
    Synthetic,
    Database,
}

impl CatalogSource {
    /// Ausente ou vazio → Synthetic; valor desconhecido → erro
    pub fn parse(raw: Option<&str>) -> Result<Self, CatalogError> {
        match raw.map(str::trim) {
            None | Some("") | Some("synthetic") => Ok(Self::Synthetic),
            Some("database") => Ok(Self::Database),
            Some(other) => Err(CatalogError::InvalidSource(other.to_string())),
        }
    }

    pub fn from_env() -> Result<Self, CatalogError> {
        Self::parse(std::env::var(SOURCE_VAR).ok().as_deref())
    }
}

#[derive(Debug, Error, PartialEq)]
pub enum CatalogError {
    #[error("TEX_CATALOG_SOURCE inválido: '{0}'; use 'synthetic' ou 'database'")]
    InvalidSource(String),
    #[error("fonte database ainda não implementada; use TEX_CATALOG_SOURCE=synthetic")]
    DatabaseNotImplemented,
}

#[derive(Debug, Default)]
pub struct Filter {
    pub program: Option<Program>,
    pub project_type: Option<ProjectType>,
    /// Busca sem diferenciar maiúsculas no código, nome, título e objetivo
    pub text: Option<String>,
}

impl Filter {
    fn matches(&self, item: &Investigation) -> bool {
        let summary = &item.summary;
        let kind = summary.project_type;
        let program_ok = self.program.is_none_or(|p| summary.program == p);
        let kind_ok = self.project_type.is_none_or(|t| kind == Some(t));
        let text_ok = self.text.as_deref().is_none_or(|t| matches_text(item, t));
        program_ok && kind_ok && text_ok
    }
}

fn matches_text(item: &Investigation, text: &str) -> bool {
    let needle = text.to_lowercase();
    let summary = &item.summary;
    let fields = [
        Some(summary.accession.as_str()),
        Some(summary.name.as_str()),
        summary.title.as_deref(),
        item.objective.as_deref(),
    ];
    fields
        .into_iter()
        .flatten()
        .any(|field| field.to_lowercase().contains(&needle))
}

/// Uma página do catálogo; `page` começa em 1 e página além do fim vem vazia
pub fn search(
    items: &[Investigation],
    filter: &Filter,
    page: usize,
    page_size: usize,
) -> InvestigationPage {
    let matching: Vec<_> = items.iter().filter(|item| filter.matches(item)).collect();
    let start = page.saturating_sub(1).saturating_mul(page_size);
    InvestigationPage {
        items: matching
            .iter()
            .skip(start)
            .take(page_size)
            .map(|item| item.summary.clone())
            .collect(),
        total: matching.len(),
        page,
        page_size,
    }
}

pub fn find(items: &[Investigation], accession: &str) -> Option<Investigation> {
    items
        .iter()
        .find(|item| item.summary.accession == accession)
        .cloned()
}

/// Carrega o catálogo da fonte escolhida; database dá erro até a consulta
/// em experiments/experiment_files existir (não devolve o sintético em silêncio)
pub fn load_investigations(source: CatalogSource) -> Result<Vec<Investigation>, CatalogError> {
    match source {
        CatalogSource::Synthetic => Ok(synthetic()),
        CatalogSource::Database => Err(CatalogError::DatabaseNotImplemented),
    }
}

/// Catálogo sintético em ordem crescente de código, como o contrato pede
pub fn synthetic() -> Vec<Investigation> {
    let micro = Some(ProjectType::Microgravity);
    let ground = Some(ProjectType::Ground);
    vec![
        synthetic_item("PSI-9001", "FLEX-2", Program::Flex, micro, 1),
        synthetic_item("PSI-9002", "BASS-II", Program::Bass, micro, 1),
        synthetic_item("PSI-9003", "ACME BRE", Program::Acme, micro, 2),
        synthetic_item("PSI-9004", "SAFFIRE-II", Program::Saffire, micro, 1),
        synthetic_item("PSI-9005", "PSI-9005", Program::Other, ground, 0),
        synthetic_item("PSI-9006", "SAME-R", Program::Same, None, 1),
    ]
}

fn synthetic_item(
    accession: &str,
    name: &str,
    program: Program,
    project_type: Option<ProjectType>,
    file_count: u64,
) -> Investigation {
    let files: Vec<InvestigationFile> = (1..=file_count)
        .map(|index| InvestigationFile {
            category: "Experimental table".to_string(),
            file_name: format!("{accession}_Experimental table_{index}.csv"),
            file_bytes: Some(SYNTHETIC_FILE_BYTES * index),
            sha256: None,
            downloaded_at: None,
        })
        .collect();
    let is_microgravity = project_type == Some(ProjectType::Microgravity);
    Investigation {
        summary: InvestigationSummary {
            accession: accession.to_string(),
            name: name.to_string(),
            title: Some(format!("Investigação sintética {name}")),
            program,
            project_type,
            sub_research_area: project_type.map(|_| "Spacecraft Fire Safety".to_string()),
            hardware: if is_microgravity {
                vec!["Combustion Integrated Rack (CIR)".to_string()]
            } else {
                Vec::new()
            },
            start_date: project_type.map(|_| "2020-01-15".to_string()),
            end_date: None,
            file_count: files.len(),
            origin_category: OriginCategory::Synthetic,
        },
        psi_version: Some(1),
        objective: Some(format!("Objetivo sintético de {name}.")),
        approach: None,
        hypothesis: None,
        doi: None,
        license: Some("CC0-1.0".to_string()),
        total_file_bytes: Some(files.iter().filter_map(|file| file.file_bytes).sum()),
        files,
        ingested_at: Some(SYNTHETIC_INGESTED_AT.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn accessions(page: &InvestigationPage) -> Vec<&str> {
        page.items.iter().map(|i| i.accession.as_str()).collect()
    }

    #[test]
    fn catalogo_sintetico_e_todo_synthetic() {
        let items = synthetic();
        assert_eq!(items.len(), 6);
        let all_synthetic = items
            .iter()
            .all(|i| i.summary.origin_category == OriginCategory::Synthetic);
        assert!(all_synthetic);
        assert_eq!(items[2].summary.file_count, 2);
        assert_eq!(items[2].total_file_bytes, Some(3072));
    }

    #[test]
    fn filtra_por_programa_e_tipo() {
        let items = synthetic();
        let by_program = Filter {
            program: Some(Program::Bass),
            ..Filter::default()
        };
        let page = search(&items, &by_program, 1, 20);
        assert_eq!(accessions(&page), ["PSI-9002"]);

        let by_type = Filter {
            project_type: Some(ProjectType::Ground),
            ..Filter::default()
        };
        let page = search(&items, &by_type, 1, 20);
        assert_eq!(accessions(&page), ["PSI-9005"]);
    }

    #[test]
    fn busca_ignora_maiusculas_e_olha_o_objetivo() {
        let items = synthetic();
        let filter = Filter {
            text: Some("OBJETIVO SINTÉTICO DE same".to_string()),
            ..Filter::default()
        };
        let page = search(&items, &filter, 1, 20);
        assert_eq!(accessions(&page), ["PSI-9006"]);
    }

    #[test]
    fn pagina_alem_do_fim_vem_vazia_com_o_total() {
        let items = synthetic();
        let page = search(&items, &Filter::default(), 2, 4);
        assert_eq!(accessions(&page), ["PSI-9005", "PSI-9006"]);
        assert_eq!(page.total, 6);

        let beyond = search(&items, &Filter::default(), usize::MAX, 100);
        assert!(beyond.items.is_empty());
        assert_eq!(beyond.total, 6);
    }

    #[test]
    fn find_so_acha_codigo_exato() {
        let items = synthetic();
        assert!(find(&items, "PSI-9003").is_some());
        assert!(find(&items, "psi-9003").is_none());
        assert!(find(&items, "PSI-1").is_none());
    }

    #[test]
    fn fonte_ausente_ou_vazia_e_synthetic() {
        for raw in [None, Some(""), Some("  "), Some("synthetic")] {
            assert_eq!(
                CatalogSource::parse(raw),
                Ok(CatalogSource::Synthetic),
                "{raw:?}"
            );
        }
        assert_eq!(
            CatalogSource::parse(Some("database")),
            Ok(CatalogSource::Database)
        );
    }

    #[test]
    fn fonte_desconhecida_e_recusada() {
        for raw in ["databse", "Synthetic", "postgres"] {
            let expected = CatalogError::InvalidSource(raw.to_string());
            assert_eq!(CatalogSource::parse(Some(raw)), Err(expected));
        }
    }

    #[test]
    fn load_so_aceita_a_fonte_implementada() {
        let items = load_investigations(CatalogSource::Synthetic).unwrap();
        assert_eq!(items, synthetic());
        assert_eq!(
            load_investigations(CatalogSource::Database),
            Err(CatalogError::DatabaseNotImplemented)
        );
    }
}
