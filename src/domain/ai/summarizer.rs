//! Esqueleto da camada de IA: a interface de resumo e uma versão fake.
//! O provedor real (chave, timeout, limite de custo) entra depois, atrás da mesma trait.

use crate::lineage::OriginCategory;

/// Resumo com a linhagem junto: quem lê sabe se veio de IA ou de um mock
#[derive(Debug, Clone, PartialEq)]
pub struct Summary {
    pub text: String,
    pub origin_category: OriginCategory,
}

pub trait Summarizer: Send + Sync {
    fn summarize(&self, context: &str) -> Summary;
}

/// Versão fake para testes e demo: não interpreta o contexto, só o devolve
#[derive(Debug, Default)]
pub struct SyntheticSummarizer;

impl SyntheticSummarizer {
    pub fn new() -> Self {
        Self
    }
}

impl Summarizer for SyntheticSummarizer {
    fn summarize(&self, context: &str) -> Summary {
        Summary {
            text: format!(
                "Resumo sintético de exemplo (sem modelo de IA). Contexto recebido: '{context}'"
            ),
            origin_category: OriginCategory::Synthetic,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resumo_fake_sai_marcado_como_sintetico() {
        let summary = SyntheticSummarizer::new().summarize("O2: 18%, Temp: 450C");
        assert_eq!(summary.origin_category, OriginCategory::Synthetic);
        assert!(summary.text.contains("O2: 18%"));
    }

    #[test]
    fn resumo_fake_nao_afirma_nada_sobre_a_chama() {
        let summary = SyntheticSummarizer::new().summarize("qualquer contexto");
        assert!(!summary.text.to_lowercase().contains("esféric"));
    }
}
