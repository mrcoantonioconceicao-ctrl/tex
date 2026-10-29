use serde::{Serialize, Deserialize};

pub const EXPERIMENT_ID: &str = "exp-space-fire-01";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Simulation {
    pub sequence: u64,
    pub temperature_c: f64,
    pub oxygen_pct: f64,
    pub flame_spread_mm_s: f64,
    pub flame_spread_rate_mm_s: f64,
    pub suppression_active: bool,
    pub risk_level: String,
}

impl Default for Simulation {
    fn default() -> Self {
        Self {
            sequence: 1,
            temperature_c: 25.0,
            oxygen_pct: 21.0,
            flame_spread_mm_s: 1.2,
            flame_spread_rate_mm_s: 1.2,
            suppression_active: false,
            risk_level: "LOW".to_string(),
        }
    }
}

impl Simulation {
    pub fn step(&mut self) {
        self.sequence += 1;
        if !self.suppression_active {
            self.temperature_c += 0.5;
            self.flame_spread_mm_s += 0.05;
            self.flame_spread_rate_mm_s = self.flame_spread_mm_s;
        } else {
            self.temperature_c -= 1.0;
            if self.temperature_c < 20.0 {
                self.temperature_c = 20.0;
            }
        }
        
        if self.temperature_c > 50.0 {
            self.risk_level = "HIGH".to_string();
        } else if self.temperature_c > 35.0 {
            self.risk_level = "MEDIUM".to_string();
        } else {
            self.risk_level = "LOW".to_string();
        }
    }
}
