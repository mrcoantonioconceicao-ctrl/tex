//! Resumo por IA: a trait, o provedor real (Google Gemini via reqwest) e a versão fake.
//! A rota POST /api/v1/ai/summarize ainda não existe (contrato marcado como planejado).
//!
//! Regras do contrato: o resumo só reformula o texto recebido, sem conclusões físicas
//! novas; resumo de modelo sai Inferred e o fake sai Synthetic. A chave vai no cabeçalho,
//! nunca na URL, e nenhuma mensagem de erro carrega a chave nem o corpo da resposta.

use std::env;
use std::fmt;
use std::time::Duration;

use reqwest::Client;
use serde_json::{json, Value};
use thiserror::Error;

use crate::lineage::OriginCategory;

const GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models";
/// Conferir no dia 14 se o modelo segue disponível; GEMINI_MODEL troca sem recompilar
const DEFAULT_MODEL: &str = "gemini-2.5-flash";
/// Abaixo do REQUEST_TIMEOUT de 10 s do api.rs: a rota responde o erro antes de ser cortada
const PROVIDER_TIMEOUT: Duration = Duration::from_secs(8);

/// Instruções fixas: reformular, não concluir (regras de física do CLAUDE.md)
const INSTRUCTIONS: &str = "Resuma em português, em até 5 frases, apenas o texto enviado, \
que descreve uma investigação de combustão da NASA. Não acrescente fatos, números nem \
conclusões que não estejam no texto. Não suponha que a chama é esférica nem que a \
ausência de gravidade apaga chamas. Se o texto não trouxer informação suficiente, diga isso.";

/// Resumo com a linhagem junto: quem lê sabe se veio de IA ou de um mock
#[derive(Debug, Clone, PartialEq)]
pub struct Summary {
    pub text: String,
    pub origin_category: OriginCategory,
}

#[derive(Debug, Error, PartialEq)]
pub enum SummarizeError {
    #[error("GEMINI_API_KEY não configurada")]
    MissingKey,
    #[error("falha ao falar com o provedor de IA: {0}")]
    Transport(String),
    #[error("provedor de IA respondeu {0}")]
    Status(u16),
    /// Resposta sem texto (ex.: bloqueada pelo filtro do provedor): erro, nunca resumo
    #[error("provedor de IA não devolveu texto")]
    EmptyResponse,
}

#[async_trait::async_trait]
pub trait Summarizer: Send + Sync {
    async fn summarize(&self, context: &str) -> Result<Summary, SummarizeError>;
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
    async fn summarize(&self, context: &str) -> Result<Summary, SummarizeError> {
        Ok(Summary {
            text: format!(
                "Resumo sintético de exemplo (sem modelo de IA). Contexto recebido: '{context}'"
            ),
            origin_category: OriginCategory::Synthetic,
        })
    }
}

/// Provedor real: API do Google Gemini via reqwest
#[derive(Clone)]
pub struct GeminiSummarizer {
    client: Client,
    api_key: String,
    model: String,
}

// Debug à mão: o derive imprimiria a chave em qualquer log com {:?}
impl fmt::Debug for GeminiSummarizer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("GeminiSummarizer")
            .field("model", &self.model)
            .field("api_key", &"<oculta>")
            .finish_non_exhaustive()
    }
}

impl GeminiSummarizer {
    /// GEMINI_API_KEY obrigatória; GEMINI_MODEL opcional
    pub fn from_env() -> Result<Self, SummarizeError> {
        let api_key = env::var("GEMINI_API_KEY")
            .ok()
            .filter(|key| !key.trim().is_empty())
            .ok_or(SummarizeError::MissingKey)?;
        let model = env::var("GEMINI_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string());
        Self::new(api_key, model)
    }

    pub fn new(api_key: String, model: String) -> Result<Self, SummarizeError> {
        let client = Client::builder()
            .timeout(PROVIDER_TIMEOUT)
            .build()
            .map_err(transport)?;
        Ok(Self {
            client,
            api_key,
            model,
        })
    }
}

#[async_trait::async_trait]
impl Summarizer for GeminiSummarizer {
    async fn summarize(&self, context: &str) -> Result<Summary, SummarizeError> {
        let url = format!("{GEMINI_BASE_URL}/{}:generateContent", self.model);
        let response = self
            .client
            .post(&url)
            .header("x-goog-api-key", &self.api_key)
            .json(&build_payload(context))
            .send()
            .await
            .map_err(transport)?;

        let status = response.status();
        if !status.is_success() {
            // O corpo pode repetir o pedido; fica fora do log e da mensagem
            tracing::warn!(%status, model = %self.model, "Gemini recusou o pedido de resumo");
            return Err(SummarizeError::Status(status.as_u16()));
        }
        let body: Value = response.json().await.map_err(transport)?;
        let text = extract_text(&body).ok_or(SummarizeError::EmptyResponse)?;
        Ok(Summary {
            text,
            origin_category: OriginCategory::Inferred,
        })
    }
}

/// Instruções no systemInstruction e o texto da investigação separado, como conteúdo
pub fn build_payload(context: &str) -> Value {
    json!({
        "systemInstruction": { "parts": [{ "text": INSTRUCTIONS }] },
        "contents": [{ "role": "user", "parts": [{ "text": context }] }]
    })
}

/// Junta os trechos de texto do primeiro candidato; None se não houver texto
pub fn extract_text(body: &Value) -> Option<String> {
    let parts = body["candidates"][0]["content"]["parts"].as_array()?;
    let text: String = parts.iter().filter_map(|part| part["text"].as_str()).collect();
    let text = text.trim();
    (!text.is_empty()).then(|| text.to_string())
}

/// without_url: a URL nunca entra na mensagem de erro
fn transport(error: reqwest::Error) -> SummarizeError {
    SummarizeError::Transport(error.without_url().to_string())
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

    #[test]
    fn extrai_e_junta_o_texto_do_primeiro_candidato() {
        let body = json!({
            "candidates": [{ "content": { "parts": [{ "text": " Parte 1." }, { "text": " Parte 2. " }] } }]
        });
        assert_eq!(extract_text(&body).as_deref(), Some("Parte 1. Parte 2."));
    }

    #[test]
    fn resposta_sem_texto_vira_erro_e_nao_resumo() {
        // Ex.: pedido bloqueado pelo filtro do provedor
        let blocked = json!({ "promptFeedback": { "blockReason": "SAFETY" } });
        let blank = json!({ "candidates": [{ "content": { "parts": [{ "text": "   " }] } }] });
        assert_eq!(extract_text(&blocked), None);
        assert_eq!(extract_text(&blank), None);
    }

    #[test]
    fn instrucoes_proibem_conclusoes_e_chama_esferica() {
        let payload = build_payload("Objetivo: medir a extinção de gotas.");
        let instructions = payload["systemInstruction"]["parts"][0]["text"]
            .as_str()
            .unwrap();
        assert!(instructions.contains("Não acrescente"));
        assert!(instructions.contains("esférica"));
        // O texto da investigação vai separado das instruções
        let content = &payload["contents"][0]["parts"][0]["text"];
        assert_eq!(content, "Objetivo: medir a extinção de gotas.");
    }

    #[test]
    fn debug_nao_mostra_a_chave() {
        let summarizer = GeminiSummarizer::new("chave-secreta".into(), "modelo".into()).unwrap();
        let printed = format!("{summarizer:?}");
        assert!(!printed.contains("chave-secreta"));
        assert!(printed.contains("modelo"));
    }

    #[tokio::test]
    async fn erro_de_rede_nao_leva_a_url_para_a_mensagem() {
        // Porta 1: conexão recusada na hora, sem sair da máquina
        let error = Client::new()
            .get("http://127.0.0.1:1/?key=chave-secreta")
            .send()
            .await
            .unwrap_err();
        let message = transport(error).to_string();
        assert!(!message.contains("chave-secreta"), "{message}");
    }
}
