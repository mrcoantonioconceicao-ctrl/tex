#![allow(
    dead_code,
    clippy::field_reassign_with_default,
    unused_variables,
    unused_imports
)]
use serde::{Deserialize, Serialize};

/// Representa a Investigação do PSI conforme a migração 0002_psi_investigations.sql
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct PsiInvestigationDto {
    pub psi_accession: String,
    pub program: String,
    pub project_type: String,
    pub objective: String,
    pub hardware: String,
    pub doi: Option<String>,
    pub license: String,
    pub cc0_compliant: bool,
}

impl PsiInvestigationDto {
    pub fn new(
        accession: &str,
        program: &str,
        project_type: &str,
        objective: &str,
        hardware: &str,
        license: &str,
    ) -> Self {
        Self {
            psi_accession: accession.to_string(),
            program: program.to_string(),
            project_type: project_type.to_string(),
            objective: objective.to_string(),
            hardware: hardware.to_string(),
            doi: None,
            license: license.to_string(),
            // Sai da licença declarada no PSI: nem toda investigação precisa ser CC0
            cc0_compliant: license == "CC0-1.0",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Valores sintéticos dentro dos CHECKs da 0002 (program, project_type)
    #[test]
    fn test_psi_dto_creation() {
        let inv = PsiInvestigationDto::new(
            "PSI-9001",
            "BASS",
            "Microgravity Investigation",
            "Flame extinction limits",
            "Standard Burner",
            "CC0-1.0",
        );
        assert_eq!(inv.psi_accession, "PSI-9001");
        assert_eq!(inv.program, "BASS");
        assert!(inv.cc0_compliant);
    }

    #[test]
    fn cc0_compliant_follows_license() {
        let inv = PsiInvestigationDto::new(
            "PSI-9002",
            "Other",
            "Ground Investigation",
            "Synthetic objective",
            "Synthetic hardware",
            "CC-BY-4.0",
        );
        assert!(!inv.cc0_compliant);
    }
}
