//! DTOs das investigações do PSI no formato de /api/v1/investigations
//! (docs/api-spec.yaml). Espelham as tabelas experiments e experiment_files
//! da migração 0002.

use serde::{Deserialize, Serialize};

use crate::lineage::OriginCategory;

/// Mesmo CHECK de experiments.program. Variantes entram no programa-base
/// (FLEX-2 → FLEX); sigla sem programa conhecido vira Other.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Program {
    #[serde(rename = "FLEX")]
    Flex,
    #[serde(rename = "ACME")]
    Acme,
    Saffire,
    #[serde(rename = "BASS")]
    Bass,
    #[serde(rename = "SAME")]
    Same,
    #[serde(rename = "DAFT")]
    Daft,
    #[serde(rename = "SPICE")]
    Spice,
    #[serde(rename = "SLICE")]
    Slice,
    #[serde(rename = "CFI")]
    Cfi,
    SoFIE,
    Other,
}

impl Program {
    /// Valor exato do contrato (diferencia maiúsculas, como o enum do OpenAPI)
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "FLEX" => Some(Self::Flex),
            "ACME" => Some(Self::Acme),
            "Saffire" => Some(Self::Saffire),
            "BASS" => Some(Self::Bass),
            "SAME" => Some(Self::Same),
            "DAFT" => Some(Self::Daft),
            "SPICE" => Some(Self::Spice),
            "SLICE" => Some(Self::Slice),
            "CFI" => Some(Self::Cfi),
            "SoFIE" => Some(Self::SoFIE),
            "Other" => Some(Self::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProjectType {
    #[serde(rename = "Microgravity Investigation")]
    MicrogravityInvestigation,
    #[serde(rename = "Ground Investigation")]
    GroundInvestigation,
    #[serde(rename = "Reduced Gravity Investigation")]
    ReducedGravityInvestigation,
}

impl ProjectType {
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "Microgravity Investigation" => Some(Self::MicrogravityInvestigation),
            "Ground Investigation" => Some(Self::GroundInvestigation),
            "Reduced Gravity Investigation" => Some(Self::ReducedGravityInvestigation),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct InvestigationFile {
    pub category: String,
    pub file_name: String,
    pub file_bytes: Option<u64>,
    /// null enquanto o arquivo não foi baixado e conferido
    pub sha256: Option<String>,
    pub downloaded_at: Option<String>,
}

/// Linha do catálogo. Campos opcionais da fonte saem como null.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct InvestigationSummary {
    pub accession: String,
    pub name: String,
    pub title: Option<String>,
    pub program: Program,
    pub project_type: Option<ProjectType>,
    pub sub_research_area: Option<String>,
    pub hardware: Vec<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub file_count: usize,
    pub origin_category: OriginCategory,
}

/// Detalhe: o resumo mais os textos da fonte e os arquivos
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Investigation {
    #[serde(flatten)]
    pub summary: InvestigationSummary,
    pub psi_version: Option<u32>,
    pub objective: Option<String>,
    pub approach: Option<String>,
    pub hypothesis: Option<String>,
    pub doi: Option<String>,
    pub license: Option<String>,
    pub total_file_bytes: Option<u64>,
    pub files: Vec<InvestigationFile>,
    pub ingested_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct InvestigationPage {
    pub items: Vec<InvestigationSummary>,
    /// Total que casa com os filtros (todas as páginas)
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn program_aceita_so_os_valores_do_contrato() {
        assert_eq!(Program::parse("FLEX"), Some(Program::Flex));
        assert_eq!(Program::parse("SoFIE"), Some(Program::SoFIE));
        assert_eq!(Program::parse("flex"), None);
        assert_eq!(Program::parse("INVALID"), None);
    }

    #[test]
    fn enums_serializam_com_o_nome_do_contrato() {
        assert_eq!(serde_json::to_string(&Program::Flex).unwrap(), "\"FLEX\"");
        assert_eq!(
            serde_json::to_string(&ProjectType::MicrogravityInvestigation).unwrap(),
            "\"Microgravity Investigation\""
        );
    }
}
