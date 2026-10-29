pub trait Summarizer: Send + Sync {
    fn summarize(&self, telemetry_context: &str) -> String;
}

pub struct SyntheticSummarizer;

impl SyntheticSummarizer {
    pub fn new() -> Self {
        Self
    }
}

impl Summarizer for SyntheticSummarizer {
    fn summarize(&self, telemetry_context: &str) -> String {
        format!(
            "[SYNTHETIC AI] Análise de chama em microgravidade | Contexto: '{}' | Status: Comportamento esférico nominal, fluxo de oxigênio estabilizado e taxa de supressão dentro dos parâmetros seguros.",
            telemetry_context
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_synthetic_summarizer_output() {
        let summarizer = SyntheticSummarizer::new();
        let result = summarizer.summarize("O2: 18%, Temp: 450C");
        assert!(result.contains("[SYNTHETIC AI]"));
        assert!(result.contains("O2: 18%"));
    }
}
