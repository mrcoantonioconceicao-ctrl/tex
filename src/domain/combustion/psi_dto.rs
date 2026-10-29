use serde::{Deserialize, Serialize};

/// Representa os dados estruturados de uma investigação do PSI (NASA)
/// em sincronia com a migração 0002_psi_investigations.sql e os mocks de ingestão.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PsiInvestigationDto {
    pub investigation_id: String,
    pub title: String,
    pub experiment_type: String, // Ex: "BASS-II", "FLEX"
    pub oxygen_concentration_pct: f64,
    pub ambient_pressure_kpa: f64,
    pub fuel_type: String,
    pub burn_rate_mm_s: Option<f64>,
    pub extinction_limits: Option<String>,
    pub cc0_compliant: bool,
}

impl PsiInvestigationDto {
    pub fn new(id: &str, title: &str, exp_type: &str, o2: f64, pressure: f64, fuel: &str) -> Self {
        Self {
            investigation_id: id.to_string(),
            title: title.to_string(),
            experiment_type: exp_type.to_string(),
            oxygen_concentration_pct: o2,
            ambient_pressure_kpa: pressure,
            fuel_type: fuel.to_string(),
            burn_rate_mm_s: None,
            extinction_limits: None,
            cc0_compliant: true, // Garantia CC0-1.0 (Domínio Público)
        }
    }
}
