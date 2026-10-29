#![allow(
    dead_code,
    clippy::field_reassign_with_default,
    unused_variables,
    unused_imports
)]
//! Simulação da câmara de combustão. Dados SINTÉTICOS (não são dados da NASA).
//!
//! A física é a mesma do laço do commit ba6e1ba, só extraída para uma função
//! pura e testável: sem supressão a temperatura sobe +12 / -4 °C em ciclos
//! alternados; acima de 900 °C a supressão liga e esfria 18,5 °C por ciclo,
//! reduzindo o oxigênio até 12%; em 870 °C ou menos a supressão desliga.

use serde::Serialize;

pub const EXPERIMENT_ID: &str = "SIM-TEX-001";

pub const INITIAL_TEMPERATURE_C: f64 = 854.5;
pub const INITIAL_OXYGEN_PCT: f64 = 21.0;
pub const FLAME_SPREAD_MM_S: f64 = 1.45;

/// Acima disto a supressão automática é acionada
pub const CRITICAL_ABOVE_C: f64 = 900.0;
/// Acima disto (sem supressão) o risco é moderado; em ou abaixo disto a supressão desliga
pub const WARNING_ABOVE_C: f64 = 870.0;

const HEATING_STEP_C: f64 = 12.0;
const COOLING_STEP_C: f64 = 4.0;
const SUPPRESSION_COOLING_C: f64 = 18.5;
const SUPPRESSION_OXYGEN_DROP_PCT: f64 = 1.2;
const OXYGEN_RECOVERY_PCT: f64 = 0.5;
const MIN_OXYGEN_PCT: f64 = 12.0;
const MAX_OXYGEN_PCT: f64 = 21.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RiskLevel {
    Nominal,
    ModerateWarning,
    CriticalSuppressionActive,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Simulation {
    pub temperature_c: f64,
    pub oxygen_pct: f64,
    pub flame_spread_mm_s: f64,
    pub risk_level: RiskLevel,
    pub suppression_active: bool,
    pub sequence: u64,
}

impl Default for Simulation {
    fn default() -> Self {
        Self {
            temperature_c: INITIAL_TEMPERATURE_C,
            oxygen_pct: INITIAL_OXYGEN_PCT,
            flame_spread_mm_s: FLAME_SPREAD_MM_S,
            risk_level: RiskLevel::Nominal,
            suppression_active: false,
            sequence: 0,
        }
    }
}

impl Simulation {
    /// Um ciclo do laço de background (a cada 5 s no servidor).
    pub fn step(&mut self) {
        self.sequence += 1;

        if self.suppression_active {
            // Resfriamento ativo e sufocamento por gás inerte
            self.temperature_c -= SUPPRESSION_COOLING_C;
            self.oxygen_pct = (self.oxygen_pct - SUPPRESSION_OXYGEN_DROP_PCT).max(MIN_OXYGEN_PCT);

            if self.temperature_c <= WARNING_ABOVE_C {
                self.suppression_active = false;
                self.risk_level = RiskLevel::Nominal;
            } else {
                self.risk_level = RiskLevel::CriticalSuppressionActive;
            }
        } else {
            // Ciclo alternado de aquecimento e resfriamento sem supressão
            if self.sequence % 2 == 1 {
                self.temperature_c += HEATING_STEP_C;
                self.oxygen_pct = (self.oxygen_pct + OXYGEN_RECOVERY_PCT).min(MAX_OXYGEN_PCT);
            } else {
                self.temperature_c -= COOLING_STEP_C;
            }

            if self.temperature_c >= CRITICAL_ABOVE_C {
                self.suppression_active = true;
                self.risk_level = RiskLevel::CriticalSuppressionActive;
            } else if self.temperature_c > WARNING_ABOVE_C {
                self.risk_level = RiskLevel::ModerateWarning;
            } else {
                self.risk_level = RiskLevel::Nominal;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comeca_nominal_com_os_valores_iniciais() {
        let sim = Simulation::default();
        assert_eq!(sim.temperature_c, INITIAL_TEMPERATURE_C);
        assert_eq!(sim.oxygen_pct, INITIAL_OXYGEN_PCT);
        assert_eq!(sim.risk_level, RiskLevel::Nominal);
        assert!(!sim.suppression_active);
    }

    #[test]
    fn alterna_aquecimento_e_resfriamento_sem_supressao() {
        let mut sim = Simulation::default();
        let t0 = sim.temperature_c;
        sim.step(); // sequência 1 (aquecimento)
        assert_eq!(sim.temperature_c, t0 + HEATING_STEP_C);

        sim.step(); // sequência 2 (resfriamento)
        assert_eq!(sim.temperature_c, t0 + HEATING_STEP_C - COOLING_STEP_C);
    }

    #[test]
    fn aciona_supressao_acima_de_900() {
        let mut sim = Simulation::default();
        sim.temperature_c = 895.0;
        sim.step(); // +12 -> 907 >= 900 -> ativa supressão
        assert!(sim.suppression_active);
        assert_eq!(sim.risk_level, RiskLevel::CriticalSuppressionActive);
    }

    #[test]
    fn supressao_esfria_reduz_oxigenio_e_desliga_em_870() {
        let mut sim = Simulation::default();
        sim.temperature_c = 910.0;
        sim.suppression_active = true;
        let o2_antes = sim.oxygen_pct;

        sim.step();
        assert!(sim.temperature_c < 910.0);
        assert!(sim.oxygen_pct < o2_antes);

        // Força queda até abaixo de 870 para desligar supressão
        sim.temperature_c = 880.0;
        sim.suppression_active = true;
        sim.step(); // -18.5 -> 861.5 <= 870 -> desliga
        assert!(!sim.suppression_active);
        assert_eq!(sim.risk_level, RiskLevel::Nominal);
    }

    #[test]
    fn oxigenio_fica_sempre_entre_12_e_21() {
        let mut sim = Simulation::default();
        sim.suppression_active = true;
        for _ in 0..50 {
            sim.step();
            assert!(sim.oxygen_pct >= MIN_OXYGEN_PCT);
            assert!(sim.oxygen_pct <= MAX_OXYGEN_PCT);
        }
    }

    #[test]
    fn passa_por_alerta_moderado_antes_do_critico() {
        let mut sim = Simulation::default();
        sim.temperature_c = 865.0;
        sim.step(); // +12 -> 877 (> 870, < 900)
        assert_eq!(sim.risk_level, RiskLevel::ModerateWarning);
    }

    #[test]
    fn supressao_manual_esfria_ja_no_proximo_ciclo() {
        let mut sim = Simulation::default();
        sim.temperature_c = 920.0;
        sim.suppression_active = true;
        sim.step();
        assert_eq!(sim.temperature_c, 920.0 - SUPPRESSION_COOLING_C);
    }

    #[test]
    fn nivel_de_risco_serializa_no_formato_da_api() {
        let json = serde_json::to_string(&RiskLevel::CriticalSuppressionActive).unwrap();
        assert_eq!(json, "\"CRITICAL_SUPPRESSION_ACTIVE\"");
    }

    #[test]
    fn reset_volta_ao_estado_inicial() {
        let mut sim = Simulation::default();
        sim.temperature_c = 950.0;
        sim.step();
        let sim_reset = Simulation::default();
        assert_eq!(sim_reset.temperature_c, INITIAL_TEMPERATURE_C);
    }
}
