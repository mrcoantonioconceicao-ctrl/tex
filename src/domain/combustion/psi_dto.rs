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
            cc0_compliant: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_psi_dto_creation() {
        let inv = PsiInvestigationDto::new(
            "PSI-001",
            "BASS-II",
            "Combustion",
            "Flame extinction limits",
            "Standard Burner",
            "CC0-1.0",
        );
        assert_eq!(inv.psi_accession, "PSI-001");
        assert_eq!(inv.program, "BASS-II");
        assert!(inv.cc0_compliant);
    }
}
