use crate::domain::combustion::psi_dto::PsiInvestigationDto;

/// Ponte conceitual para o GraphRAG e MCP.
/// No dia 14/11, este módulo receberá as consultas e fará o cruzamento
/// semântico entre os dados reais do PSI e o motor de inferência.
pub struct GraphRagBridge;

impl GraphRagBridge {
    pub fn mock_context_query(query: &str) -> String {
        format!(
            "[GraphRAG Stubs] Contexto simulado para a consulta: '{}'. Aguardando dados oficiais em 14/11.",
            query
        )
    }

    pub fn enrich_with_psi(investigation: &PsiInvestigationDto) -> String {
        format!(
            "Investigação PSI [{}] - Programa: {} | Projeto: {} | Hardware: {} | Licença: {}",
            investigation.psi_accession,
            investigation.program,
            investigation.project_type,
            investigation.hardware,
            investigation.license
        )
    }
}
