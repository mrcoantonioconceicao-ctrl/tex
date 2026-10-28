# Tex Labs - EOF (Engineering Overview & Architecture Spec)
Versão: 2.4-STABLE (Rust Native Stack)
Âmbito: Especificação Definitiva da Arquitetura Back-end

## 1. Arquitetura de Comunicação (API REST - Rust / Axum)
- **Servidor Oficial:** Rust com Axum a executar na porta `8080` (`localhost:8080`), totalmente integrado com o `docker-compose.yml` e a CI.
- **Mapeamento de Endpoints Oficiais (`api-spec.yaml`):**
  - `GET /api/v1/telemetry/latest` -> Último registo da tabela de telemetria histórica.
  - `GET /api/v1/metrics` -> Métricas consolidadas (NASA-STD-3001 / SMAC).
  - `GET /api/v1/simulation/summary` -> Payload estruturado lido de `frontend/src/data/predicoes.json`.
  - `POST /api/v1/mcp/context` -> Estado do motor e contexto local (conforme contrato).

## 2. Regras de Integridade de Dados
- **Banco de Dados (SQLite):** Manipulação segura via Rust (SQLx / rusqlite) com suporte estrito a UTF-8.
- **Conformidade:** O back-end respeita estritamente o contrato definido no `api-spec.yaml` validado pelo painel.
