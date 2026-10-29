use serde::{Deserialize, Serialize};
use crate::lineage::OriginCategory;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Program {
    FLEX,
    ACME,
    Saffire,
    BASS,
    SAME,
    DAFT,
    SPICE,
    SLICE,
    CFI,
    SoFIE,
    #[serde(other)]
    Other,
}

impl Program {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "FLEX" => Some(Self::FLEX),
            "ACME" => Some(Self::ACME),
            "Saffire" => Some(Self::Saffire),
            "BASS" => Some(Self::BASS),
            "SAME" => Some(Self::SAME),
            "DAFT" => Some(Self::DAFT),
            "SPICE" => Some(Self::SPICE),
            "SLICE" => Some(Self::SLICE),
            "CFI" => Some(Self::CFI),
            "SoFIE" => Some(Self::SoFIE),
            "Other" => Some(Self::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProjectType {
    #[serde(rename = "Microgravity Investigation")]
    MicrogravityInvestigation,
    #[serde(rename = "Ground Investigation")]
    GroundInvestigation,
    #[serde(rename = "Reduced Gravity Investigation")]
    ReducedGravityInvestigation,
}

impl ProjectType {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Microgravity Investigation" => Some(Self::MicrogravityInvestigation),
            "Ground Investigation" => Some(Self::GroundInvestigation),
            "Reduced Gravity Investigation" => Some(Self::ReducedGravityInvestigation),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestigationFile {
    pub category: String,
    pub file_name: String,
    pub file_bytes: Option<u64>,
    pub sha256: Option<String>,
    pub downloaded_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub file_count: u32,
    pub origin_category: OriginCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Investigation {
    #[serde(flatten)]
    pub summary: InvestigationSummary,
    pub psi_version: Option<i32>,
    pub objective: Option<String>,
    pub approach: Option<String>,
    pub hypothesis: Option<String>,
    pub doi: Option<String>,
    pub license: Option<String>,
    pub total_file_bytes: Option<u64>,
    pub files: Vec<InvestigationFile>,
    pub ingested_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestigationPage {
    pub items: Vec<InvestigationSummary>,
    pub total: u32,
    pub page: u32,
    pub page_size: u32,
}

// Compatibility DTO for GraphRAG context bridge
pub type PsiInvestigationDto = Investigation;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_program_parse() {
        assert_eq!(Program::parse("FLEX"), Some(Program::FLEX));
        assert_eq!(Program::parse("INVALID"), None);
    }

    #[test]
    fn test_project_type_serialization() {
        let pt = ProjectType::MicrogravityInvestigation;
        let json = serde_json::to_string(&pt).unwrap();
        assert_eq!(json, "\"Microgravity Investigation\"");
    }
}
