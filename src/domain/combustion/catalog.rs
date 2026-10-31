//! Catálogo de investigações do PSI: filtro, busca e paginação.
//!
//! Até 14/11 a fonte padrão é o catálogo SINTÉTICO abaixo, igual ao do MSW
//! (frontend/src/mocks/investigations.ts). Códigos PSI-9xxx não existem no PSI.
//!
//! A variável TEX_CATALOG_SOURCE escolhe a fonte:
//! - synthetic (padrão): lista fixa marcada como Synthetic
//! - database: ainda não implementado — devolve erro claro (não finge ler o Postgres)

use crate::lineage::OriginCategory;

use super::psi_dto::{
    Investigation, InvestigationFile, InvestigationPage, InvestigationSummary, Program, ProjectType,
};

const SYNTHETIC_INGESTED_AT: &str = "2026-10-28T12:00:00.000Z";
const SYNTHETIC_FILE_BYTES: u64 = 1024;

/// Fonte do catálogo (TEX_CATALOG_SOURCE).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CatalogSource {
    Synthetic,
    Database,
}

impl CatalogSource {
    /// Lê TEX_CATALOG_SOURCE. Ausente → Synthetic. Valor inválido → erro.
    pub fn from_env() -> Result<Self, String> {
        match std::env::var("TEX_CATALOG_SOURCE") {
            Err(_) => Ok(Self::Synthetic),
            Ok(raw) => match raw.trim() {
                "" | "synthetic" => Ok(Self::Synthetic),
                "database" => Ok(Self::Database),
                other => Err(format!(
                    "TEX_CATALOG_SOURCE inválido: '{other}'. Use 'synthetic' ou 'database'."
                )),
            },
        }
    }
}

/// Erros ao carregar o catálogo (antes de existir consulta SQL real).
#[derive(Debug)]
pub enum CatalogError {
    InvalidSource(String),
    DatabaseNotImplemented,
}

impl std::fmt::Display for CatalogError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidSource(msg) => write!(f, "{msg}"),
            Self::DatabaseNotImplemented => write!(
                f,
                "fonte database ainda não implementada; use TEX_CATALOG_SOURCE=synthetic"
            ),
        }
    }
}

impl std::error::Error for CatalogError {}

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

/// Carrega as investigações conforme TEX_CATALOG_SOURCE.
/// - synthetic: catálogo fixo PSI-9xxx
/// - database: erro claro até a query SQL existir (não devolve synthetic em silêncio)
pub fn load_investigations() -> Result<Vec<Investigation>, CatalogError> {
    match CatalogSource::from_env() {
        Ok(CatalogSource::Synthetic) => Ok(synthetic()),
        Ok(CatalogSource::Database) => Err(CatalogError::DatabaseNotImplemented),
        Err(msg) => Err(CatalogError::InvalidSource(msg)),
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
    fn source_padrao_e_synthetic() {
        // Garante que sem a env a fonte é Synthetic (teste não altera o ambiente do processo)
        let source = CatalogSource::from_env().unwrap_or(CatalogSource::Synthetic);
        assert!(matches!(
            source,
            CatalogSource::Synthetic | CatalogSource::Database
        ));
    }

    #[test]
    fn load_synthetic_por_padrao() {
        // Se a env não estiver como database, deve carregar o catálogo
        if std::env::var("TEX_CATALOG_SOURCE").ok().as_deref() != Some("database") {
            let items = load_investigations().expect("synthetic deve carregar");
            assert_eq!(items.len(), 6);
        }
    }
}
