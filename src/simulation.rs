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

#[derive(Debug, Clone, PartialEq)]
pub struct Simulation {
    pub temperature_c: f64,
    pub oxygen_pct: f64,
    pub flame_spread_mm_s: f64,
    pub risk_level: RiskLevel,
    pub suppression_active: bool,
    /// Número do ciclo; cresce a cada passo e volta a 0 no reset
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
            return;
        }

        if self.sequence.is_multiple_of(2) {
            self.temperature_c += HEATING_STEP_C;
        } else {
            self.temperature_c -= COOLING_STEP_C;
        }
        self.oxygen_pct = (self.oxygen_pct + OXYGEN_RECOVERY_PCT).min(MAX_OXYGEN_PCT);

        if self.temperature_c > CRITICAL_ABOVE_C {
            self.trigger_suppression();
        } else if self.temperature_c > WARNING_ABOVE_C {
            self.risk_level = RiskLevel::ModerateWarning;
        } else {
            self.risk_level = RiskLevel::Nominal;
        }
    }

    /// Liga a supressão (automática acima de 900 °C ou manual pela API).
    /// O próximo ciclo já começa a resfriar.
    pub fn trigger_suppression(&mut self) {
        self.suppression_active = true;
        self.risk_level = RiskLevel::CriticalSuppressionActive;
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run_until(sim: &mut Simulation, max_steps: u32, done: impl Fn(&Simulation) -> bool) -> bool {
        for _ in 0..max_steps {
            sim.step();
            if done(sim) {
                return true;
            }
        }
        false
    }

    #[test]
    fn comeca_nominal_com_os_valores_iniciais() {
        let sim = Simulation::default();
        assert_eq!(sim.temperature_c, INITIAL_TEMPERATURE_C);
        assert_eq!(sim.oxygen_pct, INITIAL_OXYGEN_PCT);
        assert_eq!(sim.risk_level, RiskLevel::Nominal);
        assert!(!sim.suppression_active);
        assert_eq!(sim.sequence, 0);
    }

    #[test]
    fn alterna_aquecimento_e_resfriamento_sem_supressao() {
        let mut sim = Simulation::default();
        sim.step(); // ciclo 1 (ímpar): -4
        assert_eq!(sim.temperature_c, INITIAL_TEMPERATURE_C - COOLING_STEP_C);
        sim.step(); // ciclo 2 (par): +12
        assert_eq!(
            sim.temperature_c,
            INITIAL_TEMPERATURE_C - COOLING_STEP_C + HEATING_STEP_C
        );
        assert_eq!(sim.sequence, 2);
    }

    #[test]
    fn passa_por_alerta_moderado_antes_do_critico() {
        let mut sim = Simulation::default();
        assert!(run_until(&mut sim, 50, |s| s.risk_level == RiskLevel::ModerateWarning));
        assert!(sim.temperature_c > WARNING_ABOVE_C && sim.temperature_c <= CRITICAL_ABOVE_C);
        assert!(!sim.suppression_active);
    }

    #[test]
    fn aciona_supressao_acima_de_900() {
        let mut sim = Simulation::default();
        assert!(run_until(&mut sim, 100, |s| s.suppression_active));
        assert!(sim.temperature_c > CRITICAL_ABOVE_C);
        assert_eq!(sim.risk_level, RiskLevel::CriticalSuppressionActive);
    }

    #[test]
    fn supressao_esfria_reduz_oxigenio_e_desliga_em_870() {
        let mut sim = Simulation::default();
        run_until(&mut sim, 100, |s| s.suppression_active);
        let peak = sim.temperature_c;

        sim.step();
        assert!(sim.temperature_c < peak, "a supressão precisa esfriar");
        assert!(sim.oxygen_pct < INITIAL_OXYGEN_PCT);

        assert!(run_until(&mut sim, 20, |s| !s.suppression_active));
        assert!(sim.temperature_c <= WARNING_ABOVE_C);
        assert_eq!(sim.risk_level, RiskLevel::Nominal);
    }

    #[test]
    fn oxigenio_fica_sempre_entre_12_e_21() {
        let mut sim = Simulation::default();
        for _ in 0..500 {
            sim.step();
            assert!(
                (MIN_OXYGEN_PCT..=MAX_OXYGEN_PCT).contains(&sim.oxygen_pct),
                "oxigênio fora da faixa: {}",
                sim.oxygen_pct
            );
        }
    }

    #[test]
    fn supressao_manual_esfria_ja_no_proximo_ciclo() {
        let mut sim = Simulation::default();
        sim.trigger_suppression();
        assert!(sim.suppression_active);

        sim.step();
        assert_eq!(
            sim.temperature_c,
            INITIAL_TEMPERATURE_C - SUPPRESSION_COOLING_C
        );
        // 854,5 - 18,5 = 836 ≤ 870: a supressão já cumpriu o papel e desliga
        assert!(!sim.suppression_active);
        assert_eq!(sim.risk_level, RiskLevel::Nominal);
    }

    #[test]
    fn reset_volta_ao_estado_inicial() {
        let mut sim = Simulation::default();
        run_until(&mut sim, 100, |s| s.suppression_active);
        sim.reset();
        assert_eq!(sim, Simulation::default());
    }

    #[test]
    fn nivel_de_risco_serializa_no_formato_da_api() {
        let json = |r: RiskLevel| serde_json::to_string(&r).unwrap();
        assert_eq!(json(RiskLevel::Nominal), "\"NOMINAL\"");
        assert_eq!(json(RiskLevel::ModerateWarning), "\"MODERATE_WARNING\"");
        assert_eq!(
            json(RiskLevel::CriticalSuppressionActive),
            "\"CRITICAL_SUPPRESSION_ACTIVE\""
        );
    }
}
