//! Linhagem de dados (regra do CLAUDE.md): todo dado exposto diz de onde veio.
//! É o único mecanismo de marcação de dado sintético do projeto.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
// Hoje o backend só produz Synthetic (simulação); as demais variantes fazem
// parte do contrato e passam a ser usadas quando entrarem dados reais.
#[allow(dead_code)]
pub enum OriginCategory {
    /// Medido por sensor
    Measured,
    /// Publicado em artigo/relatório (NTRS, PSI)
    Published,
    /// Calculado a partir de outros dados
    Derived,
    /// Inferido por IA
    Inferred,
    /// Teste, mock ou simulação
    Synthetic,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializa_com_o_nome_do_contrato() {
        assert_eq!(
            serde_json::to_string(&OriginCategory::Synthetic).unwrap(),
            "\"Synthetic\""
        );
        assert_eq!(
            serde_json::to_string(&OriginCategory::Measured).unwrap(),
            "\"Measured\""
        );
    }
}
