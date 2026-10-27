# Tex Labs - EOF (Engineering Overview & Architecture Spec)
Versão: 2.4-STABLE
Âmbito: Especificação Definitiva da Ponte Front/Back-end

## 1. Arquitetura de Comunicação (API REST Local)
- **Servidor Ativo:** Python com FastAPI a executar na porta `8000` (`localhost:8000`).
- **Mapeamento de Endpoints Oficiais:**
  - `GET /api/v1/telemetry/latest` -> Último registo da tabela de telemetria histórica.
  - `GET /api/v1/metrics` -> Métricas consolidadas (NASA-STD-3001 / SMAC).
  - `GET /api/v1/simulation/summary` -> Payload estruturado do `relatorio_predicoes_avancadas.json`.
  - `GET /api/v1/mcp/context` -> Estado do motor e contexto local.

## 2. Regras de Integridade de Dados
- **SQLite:** Inicialização obrigatória de conexões com `text_factory = str`.
- **JSON I/O:** Leitura e escrita restritas com parâmetro `encoding='utf-8'` para assegurar a renderização correta de termos técnicos em português.
