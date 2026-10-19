# Tex Labs, NASA Space Apps Challenge 2026

## Contexto do projeto
- Hackathon: NASA Space Apps Challenge 2026. Time Tex Labs, formado por Willian (LokusS) e Marco.
- Desafio: combustão em microgravidade ("Free-Fall Flame: AI-Driven Fire Safety Insights from Microgravity Combustion Data").
- Missão do sistema: monitoramento, combate inteligente e mitigação autônoma de incêndios em habitats espaciais (ex.: ISS).
- Repositório: https://github.com/mrcoantonioconceicao-ctrl/tex
- Datas: enunciados completos em 28/10/2026; o hackathon começa em 14/11/2026. A NASA pede que o time NÃO comece a trabalhar no desafio antes de 14/11. Até lá, limite-se a estudo, preparo de ambiente e planejamento.
- Regras: times de 1 a 6 pessoas, todos no mesmo Local Event, um projeto por desafio.

## Divisão de responsabilidades
- Marco: backend em Rust (Axum), arquitetura DDD + SOA, camada de segurança/auditoria Web3. NÃO alterar o core do backend.
- Willian (LokusS):
  - Engenharia de dados e ingestão (Azure + PostgreSQL): coletar, limpar e organizar dados de combustão e microgravidade da NASA (NTRS, relatórios CIR/ISS) para alimentar a camada de IA e o GraphRAG.
  - Dashboard front-end (React / Node.js): painel interativo para engenheiros espaciais consultarem relatórios, verem alertas de risco de incêndio em tempo real e interagirem com os dados consolidados.

## Stack do backend (do Marco)
- Rust + Axum.
- DDD com os domínios: CombustionAnalysisDomain, GraphRAGKnowledgeDomain, Web3AuditTrailDomain, ComplianceDomain.
- Aster Event Bus, GraphRAG, MCP (Model Context Protocol), Token Crusher, trilha de auditoria com SHA-256.
- Estado atual: telemetria ainda MOCKADA. Não assumir que os valores são reais nem que o formato está definitivo.

## Stack do front-end (decisão de 19/10/2026)
- SPA com Vite + React + TypeScript (não Next.js): o Axum já é o backend, o painel não precisa de SSR/SEO e o build estático pode ser servido pelo próprio Axum.
- Sugestões: TanStack Query (polling/cache da telemetria), MSW (mocks), Recharts ou ECharts (gráficos), Tailwind (estilo).
- Em dev, usar `server.proxy` do Vite para `/api` → `http://127.0.0.1:8080`.
- A ingestão de dados (NTRS, PSI/CIR → PostgreSQL) fica em scripts/jobs separados do front.
- A confirmar com o Marco: o Axum servir o build estático do front.

## API local (http://127.0.0.1:8080)
- `GET /api/v1/telemetry/latest`: temperatura da câmara, oxigênio, taxa de propagação de chama e nível de risco (ex.: `MODERATE_WARNING`, `CRITICAL_SUPPRESSION_ACTIVE`).
- `GET /api/v1/metrics`: latência (µs) do parser AST e do GraphRAG, eficiência do Token Crusher.
- `POST /api/v1/mcp/context`: envia uma query e recebe contexto técnico de segurança otimizado para IA.
- Rodar o backend: `cargo run` (requer Rust/Cargo). Alternativa: mockar as chamadas no front.

## Fluxo Git
- Nunca editar direto na `main`.
- Branch do front-end: `feature/frontend-dashboard`.
- Commits no padrão convencional, ex.: `feat: implement frontend dashboard and telemetry UI`.
- Enviar com `git push origin feature/frontend-dashboard` e abrir Pull Request para o backend principal.

## Como o Claude deve trabalhar aqui
- Responder em português (Brasil).
- Trabalhar só na parte do Willian (dados e front-end); não editar o backend Rust sem pedido explícito.
- Antes de codar o front, definir os tipos TypeScript dos endpoints e um mock local, já que o backend ainda é mock.
- Tratar o formato das respostas da API como provisório e isolar o acesso a ela em uma camada única (fácil de trocar mock por API real).
- Não inventar dados da NASA: quando precisar de dados reais, indicar a fonte (NTRS, CIR/ISS) e como obtê-los.
- Respeitar a regra de 14/11: sugerir apenas estudo, estrutura e planejamento até lá.
