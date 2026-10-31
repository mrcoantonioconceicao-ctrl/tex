//! Provedor real de IA usando a API do Google Gemini via reqwest e versão fake.

use crate::lineage::OriginCategory;
use reqwest::Client;
use serde_json::json;
use std::env;

/// Resumo com a linhagem junto: quem lê sabe se veio de IA ou de um mock
#[derive(Debug, Clone, PartialEq)]
pub struct Summary {
    pub text: String,
    pub origin_category: OriginCategory,
}

#[async_trait::async_trait]
pub trait Summarizer: Send + Sync {
    async fn summarize(&self, context: &str) -> Result<Summary, String>;
}

/// Versão fake para testes e demo: não interpreta o contexto, só o devolve
#[derive(Debug, Default)]
pub struct SyntheticSummarizer;

impl SyntheticSummarizer {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait::async_trait]
impl Summarizer for SyntheticSummarizer {
    async fn summarize(&self, context: &str) -> Result<Summary, String> {
        Ok(Summary {
            text: format!(
                "Resumo sintético de exemplo (sem modelo de IA). Contexto recebido: '{context}'"
            ),
            origin_category: OriginCategory::Synthetic,
        })
    }
}

/// Provedor real integrando a API do Google Gemini via reqwest
#[derive(Debug, Clone)]
pub struct GeminiSummarizer {
    client: Client,
    api_key: String,
    model: String,
}

impl GeminiSummarizer {
    pub fn new() -> Result<Self, String> {
        let api_key = env::var("GEMINI_API_KEY")
            .map_err(|_| "Variável de ambiente GEMINI_API_KEY não configurada".to_string())?;

        let model = env::var("GEMINI_MODEL").unwrap_or_else(|_| "gemini-1.5-flash".to_string());

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| format!("Erro ao criar cliente HTTP: {e}"))?;

        Ok(Self {
            client,
            api_key,
            model,
        })
    }
}

#[async_trait::async_trait]
impl Summarizer for GeminiSummarizer {
    async fn summarize(&self, context: &str) -> Result<Summary, String> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        let prompt = format!(
            "Analise o seguinte contexto de combustão/investigação espacial e forneça um resumo conciso:\n\n{context}"
        );

        let payload = json!({
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        });

        let response = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Falha na requisição HTTP para o Gemini: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let err_body = response.text().await.unwrap_or_default();
            return Err(format!(
                "Erro da API do Gemini (status {status}): {err_body}"
            ));
        }

        let body: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Falha ao decodificar resposta JSON do Gemini: {e}"))?;

        // Extrai o texto gerado do JSON de resposta padrão do Gemini
        let text = body["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .unwrap_or("Não foi possível extrair o resumo da resposta do modelo.")
            .to_string();

        Ok(Summary {
            text,
            origin_category: OriginCategory::Inferred,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn resumo_fake_sai_marcado_como_sintetico() {
        let summary = SyntheticSummarizer::new()
            .summarize("O2: 18%, Temp: 450C")
            .await
            .unwrap();
        assert_eq!(summary.origin_category, OriginCategory::Synthetic);
        assert!(summary.text.contains("O2: 18%"));
    }

    #[tokio::test]
    async fn resumo_fake_nao_afirma_nada_sobre_a_chama() {
        let summary = SyntheticSummarizer::new()
            .summarize("qualquer contexto")
            .await
            .unwrap();
        assert!(!summary.text.to_lowercase().contains("esféric"));
    }
}
