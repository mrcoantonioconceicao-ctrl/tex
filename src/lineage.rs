use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OriginCategory {
    Synthetic,
    PsisDatabase,
    TelemetryDerived,
}

impl OriginCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            OriginCategory::Synthetic => "Synthetic",
            OriginCategory::PsisDatabase => "PsisDatabase",
            OriginCategory::TelemetryDerived => "TelemetryDerived",
        }
    }
}
