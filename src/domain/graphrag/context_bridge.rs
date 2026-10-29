use crate::domain::combustion::psi_dto::Investigation;

pub struct GraphRagBridge;

impl GraphRagBridge {
    pub fn build_context_from_investigation(investigation: &Investigation) -> String {
        format!(
            "Investigation Accession: {}, Name: {}, Program: {:?}, ProjectType: {:?}, Hardware: {:?}",
            investigation.summary.accession,
            investigation.summary.name,
            investigation.summary.program,
            investigation.summary.project_type,
            investigation.summary.hardware
        )
    }
}
