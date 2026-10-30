use crate::domain::combustion::psi_dto::Investigation;

/// Ponte conceitual para o GraphRAG e o MCP. Depois de 14/11 cruza os dados
/// reais do PSI com o motor de inferência; hoje só monta o texto de contexto.
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
