//! Componentes do pipeline (AST, Aster EventBus, GraphRAG, MCP, Token Crusher e
//! trilha de auditoria SHA-256), restaurados do main.rs até o commit 4b760cd.
//! Ainda são stubs: o GraphRAG não consulta uma base real e o MCP devolve um
//! contexto marcado como [SIMULADO] até a ingestão do NTRS alimentar o grafo.

use std::time::Instant;

use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::lineage::OriginCategory;
use crate::simulation::{Simulation, EXPERIMENT_ID};

// ---- Token Crusher ----

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TokenMetrics {
    pub original_estimated_tokens: usize,
    pub compressed_tokens: usize,
    pub compression_efficiency_pct: f64,
}

/// Estimativa usual de ~4 caracteres por token. A versão anterior contava
/// palavras x 4, o que dava sempre 0% (remover espaços não muda o nº de palavras).
fn estimate_tokens(text: &str) -> usize {
    text.chars().count().div_ceil(4)
}

pub struct TokenCrusher;

impl TokenCrusher {
    /// Normaliza espaços em branco e mede a redução estimada de tokens.
    pub fn crush_payload(raw_text: &str) -> (String, TokenMetrics) {
        let cleaned = raw_text.split_whitespace().collect::<Vec<_>>().join(" ");
        let original = estimate_tokens(raw_text);
        let compressed = estimate_tokens(&cleaned);
        let efficiency = if original > 0 {
            (original - compressed) as f64 / original as f64 * 100.0
        } else {
            0.0
        };
        println!("[Token Crusher] {original} -> {compressed} tokens estimados ({efficiency:.1}% de redução)");

        let metrics = TokenMetrics {
            original_estimated_tokens: original,
            compressed_tokens: compressed,
            compression_efficiency_pct: (efficiency * 10.0).round() / 10.0,
        };
        (cleaned, metrics)
    }
}

// ---- GraphRAG ----

pub struct GraphRAGKnowledgeEngine;

impl GraphRAGKnowledgeEngine {
    /// Devolve o insight e a latência medida em microssegundos.
    pub fn query_knowledge_base(term: &str) -> (String, u64) {
        let start = Instant::now();
        println!("[GraphRAG] Mapeando entidades e relações para: {term}");
        let insight = format!("Entidades relacionadas a '{term}' no experimento {EXPERIMENT_ID}.");
        (insight, start.elapsed().as_micros() as u64)
    }
}

// ---- MCP Enterprise ----

#[derive(Debug, Clone, Serialize)]
pub struct McpContextResponse {
    pub protocol: String,
    pub status: String,
    pub compressed_context: String,
    pub token_metrics: TokenMetrics,
    pub origin_category: OriginCategory,
}

pub struct McpEnterpriseServer;

impl McpEnterpriseServer {
    pub fn provide_context(query: &str, graph_insight: &str) -> McpContextResponse {
        println!("[MCP Enterprise] Injetando contexto para: '{query}'");
        let raw_knowledge = format!(
            "[SIMULADO]   Contexto técnico de segurança contra incêndio em microgravidade   \
             para a consulta '{query}'.   {graph_insight}   \
             A base de conhecimento ainda não foi alimentada com os relatórios do NTRS."
        );
        let (compressed_context, token_metrics) = TokenCrusher::crush_payload(&raw_knowledge);

        McpContextResponse {
            protocol: "MCP-Enterprise-v1".to_string(),
            status: "ACTIVE_OPTIMIZED".to_string(),
            compressed_context,
            token_metrics,
            // Stub: o contexto ainda não vem da base de conhecimento real
            origin_category: OriginCategory::Synthetic,
        }
    }
}

// ---- Trilha de auditoria (Web3 / SHA-256) ----

pub struct Web3AuditSmartContract;

impl Web3AuditSmartContract {
    pub fn anchor_telemetry_hash(sim: &Simulation) -> String {
        let payload = format!(
            "{EXPERIMENT_ID}:{}:{}:{:?}",
            sim.temperature_c, sim.oxygen_pct, sim.risk_level
        );
        format!("{:x}", Sha256::digest(payload.as_bytes()))
    }
}

// ---- Parser AST ----

pub struct AstTelemetryParser;

impl AstTelemetryParser {
    /// Valida a leitura e devolve a latência da validação em microssegundos.
    pub fn parse_and_validate(sim: &Simulation) -> Result<u64, String> {
        let start = Instant::now();
        if sim.temperature_c > 0.0 && sim.oxygen_pct > 0.0 {
            Ok(start.elapsed().as_micros() as u64)
        } else {
            Err("Anomalia estrutural na leitura de telemetria.".into())
        }
    }
}

// ---- Aster EventBus ----

pub struct AsterEventBus;

impl AsterEventBus {
    pub fn dispatch_event(event_name: &str, sim: &Simulation) {
        println!(
            "[Aster EventBus] >>> '{event_name}' | {:.1} °C | risco {:?}",
            sim.temperature_c, sim.risk_level
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_crusher_remove_espacos_e_mede_a_reducao() {
        let (cleaned, metrics) = TokenCrusher::crush_payload("fogo    em      microgravidade   ");
        assert_eq!(cleaned, "fogo em microgravidade");
        assert!(metrics.compressed_tokens < metrics.original_estimated_tokens);
        assert!(metrics.compression_efficiency_pct > 0.0);
    }

    #[test]
    fn token_crusher_nao_inventa_compressao_em_texto_limpo() {
        let (_, metrics) = TokenCrusher::crush_payload("texto sem espaços extras");
        assert_eq!(metrics.compression_efficiency_pct, 0.0);
    }

    #[test]
    fn token_crusher_aceita_texto_vazio() {
        let (cleaned, metrics) = TokenCrusher::crush_payload("");
        assert_eq!(cleaned, "");
        assert_eq!(metrics.compression_efficiency_pct, 0.0);
    }

    #[test]
    fn mcp_devolve_contexto_marcado_como_simulado_com_a_consulta() {
        let response = McpEnterpriseServer::provide_context("oxigênio", "insight");
        assert_eq!(response.protocol, "MCP-Enterprise-v1");
        assert!(response.compressed_context.starts_with("[SIMULADO]"));
        assert!(response.compressed_context.contains("oxigênio"));
        assert!(!response.compressed_context.contains("  "));
    }

    #[test]
    fn hash_de_auditoria_e_deterministico_e_muda_com_a_leitura() {
        let sim = Simulation::default();
        let hash = Web3AuditSmartContract::anchor_telemetry_hash(&sim);
        assert_eq!(hash.len(), 64);
        assert_eq!(hash, Web3AuditSmartContract::anchor_telemetry_hash(&sim));

        let hotter = Simulation {
            temperature_c: 999.0,
            ..Simulation::default()
        };
        assert_ne!(hash, Web3AuditSmartContract::anchor_telemetry_hash(&hotter));
    }

    #[test]
    fn parser_rejeita_leitura_sem_sentido_fisico() {
        assert!(AstTelemetryParser::parse_and_validate(&Simulation::default()).is_ok());
        let broken = Simulation {
            oxygen_pct: 0.0,
            ..Simulation::default()
        };
        assert!(AstTelemetryParser::parse_and_validate(&broken).is_err());
    }
}
