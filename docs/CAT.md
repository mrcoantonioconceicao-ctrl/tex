# Tex Labs - CAT (Changelog & Action Tasks)
Data: 27 de Outubro de 2026
Estado: Back-end Ativo e Integrado (FastAPI)

## 1. Changelog (O que foi executado)
- [x] **Arquitetura de API:** Implementado o servidor FastAPI (`server.py`) para substituir os ficheiros estáticos e expor as rotas reais consumidas pelo front-end (`/api/v1/telemetry/latest`, `/api/v1/metrics`, `/api/v1/mcp/context`, `/api/v1/simulation/summary`).
- [x] **Sanitização de Encoding:** Forçado o uso de UTF-8 estrito (`encoding='utf-8'` e `text_factory = str` no SQLite) para eliminar falhas de acentuação na interface.
- [x] **Limpeza de Ficheiros:** Removido o `dashboard_sync.json` estático que continha falsos positivos de HTTP 200.
- [x] **Dependências:** Instalados e configurados `fastapi`, `uvicorn` e o motor de validação interno.

## 2. Action Tasks (Próximos Passos)
- [ ] **[Validação de Endpoints]** Testar as respostas completas da API via `curl` no terminal.
- [ ] **[Sincronização Git]** Consolidar as alterações com commit e push para o repositório remoto.
