# Checklist do dia 14/11

Roteiro para o primeiro dia do hackathon. Até 14/11 o repositório só tem estrutura, contrato e dados **sintéticos** (regra da NASA e do CLAUDE.md). Este checklist é o que muda a partir daí, em ordem, com dono e como conferir.

Legenda: **W** = Willian, **M** = Marco, **W+M** = juntos.

> **Submissão do projeto: até 15/11.** O hackathon começa em 14/11; tudo abaixo cabe em dois dias.

## 0. Até 13/11 (pré-requisitos)

- [x] **W+M** PRs do preparo mergeados, com CI verde na `main`:
  - [x] #45: catálogo lendo o PostgreSQL (`TEX_CATALOG_SOURCE=database`) e migração 0003.
  - [x] #46/#48: contrato do `POST /ai/summarize` (planejado) e mock.
  - [x] #49: download das tabelas do PSI, travado até 14/11.
- [ ] **W** Ensaio da stack na máquina Linux do Willian, a que vai para o evento: `make up`, `make smoke`, painel em http://localhost:3000.
- [ ] **W** Ensaio sem Docker, de reserva: `make install` e depois `make frontend` com `VITE_USE_MOCKS=true` (http://localhost:5173).
- [x] **W+M** Provedor de IA do resumo: API do Google Gemini (#50), com a troca isolada pela trait `Summarizer`.
- [ ] **W+M** Chave do Gemini (`GEMINI_API_KEY`) criada, com limite de gasto, e guardada **só** no `.env` local, nunca no repositório. Perguntar à organização se haverá crédito de IA para os times.
- [x] **W+M** Inscrição no Local Event: time de duas pessoas (Willian e Marco), sem pendências.

## 1. Abertura (manhã do dia 14)

- [ ] **W+M** Ler o enunciado final no site do Space Apps e comparar com [`conhecimento/enunciado.md`](conhecimento/enunciado.md). Anotar as diferenças no próprio arquivo, com a data.
- [ ] **W+M** Conferir se o contrato (`api-spec.yaml`) e o schema (migrações 0001 a 0003) cobrem o que o enunciado pede. O que faltar vira migração ou campo novo; o schema mínimo nunca perde nada.
- [ ] **W+M** Decidir a ordem do dia (seção 6) e dividir as tarefas.

## 2. Dados (Willian)

Metadados do PSI (a ingestão já existe e só lê a API pública):

- [ ] Ensaio sem gravar: `cd ingestion && npm run ingest:psi -- --dry-run`. Esperado: 26 investigações na busca `combustion` (número de 28/10; conferir se mudou).
- [ ] Gravar no banco da stack: `npm run ingest:psi` (o `DATABASE_URL` padrão aponta para o Postgres do `make up`, na porta 5433).
- [ ] Conferir no `make db-shell`:

  ```sql
  -- todas com raw e marcadas como Published
  SELECT count(*) AS total,
         count(*) FILTER (WHERE raw IS NULL) AS sem_raw,
         count(*) FILTER (WHERE origin_category <> 'Published') AS fora_de_published
    FROM experiments WHERE psi_accession IS NOT NULL;

  -- a coleta ficou registrada
  SELECT source, status, fetched, upserted FROM ingestion_runs ORDER BY id DESC LIMIT 3;
  ```

  Esperado: `sem_raw = 0`, `fora_de_published = 0` e a última coleta com `status = ok`.

Tabelas experimentais em CSV (cerca de 25 arquivos, uns 230 KB, segundo o [`psi.md`](conhecimento/psi.md)):

- [ ] Baixar as tabelas (código pronto desde 31/10 e testado só com dado sintético; a CLI recusa rodar antes de 14/11):
  - [ ] `npm run download:psi -- --dry-run` lista o que falta, sem rede.
  - [ ] `npm run download:psi -- --accession PSI-25` primeiro, para conferir o formato da resposta do link assinado (hoje é **hipótese** em `psi-download.ts`); depois `npm run download:psi` para todas.
  - [ ] Conferir: `SELECT count(*) FILTER (WHERE sha256 IS NULL) FROM experiment_files WHERE category = 'Experimental table';` deve dar 0. Os CSVs ficam em `ingestion/data/psi/`, fora do git.
- [ ] Conferir as colunas CSV a CSV antes de gravar medições. Hoje a variação de colunas entre investigações é **hipótese**.
- [ ] Medição de sensor entra como `Measured` com `source_file_id`; a regra do banco já recusa o que vier sem a origem.

NTRS (bibliografia):

- [ ] `make ingest ARGS='--max 100'` com o termo combinado no dia, depois `SELECT count(*) FROM documents;`.
- [ ] Etapas 3 a 9 do pipeline (seleção, PDFs com hash, extração, chunking) começam aqui, na ordem decidida na seção 6.

## 3. Backend (Marco)

- [ ] Ligar o catálogo no banco: `TEX_CATALOG_SOURCE=database` no `environment` do backend no `docker-compose.yml` (ou no `.env`). Depois, `make restart`.
- [ ] `curl -s localhost:8080/api/v1/investigations | jq '.total, .items[0].origin_category'`. Esperado: o mesmo total da seção 2 e `"Published"`.
- [ ] `curl -s localhost:8080/api/v1/investigations/PSI-25 | jq '.files | length'` (ou outro código real) traz os arquivos.
- [ ] Banco parado (`docker compose stop db`): o catálogo responde **503** e o `/health` continua `ok` com `database: down`. Depois, `docker compose start db`.
- [ ] `POST /ai/summarize` de verdade, seguindo o contrato do #46:
  - [ ] Implementação real da trait `Summarizer` (`src/domain/ai/summarizer.rs`), com chave por variável de ambiente, timeout e limite de custo.
  - [ ] Resposta `Inferred` com `model` preenchido; mock e testes continuam `Synthetic`.
  - [ ] 422 `NO_SOURCE_TEXT` quando a investigação não tem texto. O resumo só reformula `objective`, `approach` e `hypothesis`.
  - [ ] Tirar o `x-status: planned` do `api-spec.yaml` quando a rota existir.
- [ ] MCP de verdade (`search_documents`, `get_measurements`): linguagem e escopo decididos pelo Marco. Até lá, `/mcp/context` continua sendo um "endpoint de contexto".

## 4. Front (Willian)

- [ ] Rodar contra o backend real (`VITE_USE_MOCKS=false`) e conferir o catálogo com os dados da seção 2.
- [ ] Erros visíveis na tela: backend fora (rede), 503 do catálogo, 404 de código inexistente.
- [ ] Selo de origem em tudo que aparece: `Published` (PSI/NTRS), `Inferred` (resumo de IA) e `Synthetic` (simulação, mocks).
- [ ] Tela do resumo por IA só depois de a rota existir, sempre com o texto original do PSI ao lado e o selo `Inferred`.
- [ ] A tela da simulação continua dizendo que os dados são sintéticos.

## 5. Revisão antes do pitch (W+M)

Ler a tela, o README e os slides procurando:

- [ ] "Telemetria ao vivo da ISS" ou equivalente: **não pode**. A telemetria é simulação com dados sintéticos.
- [ ] Chama tratada como esférica por padrão, ou "sem gravidade a chama apaga": **não pode**.
- [ ] Predição apresentada como validada fisicamente: **não pode**. Projeções saem `Synthetic`, testes publicados saem `Published`.
- [ ] `/mcp/context` chamado de "MCP": só depois do servidor MCP de verdade.
- [ ] Todo número na tela com fonte (PSI, NTRS ou simulação) e `origin_category` correta.
- [ ] Fatos, hipóteses e decisões separados no texto do pitch.

## 6. Decisões para tomar no dia 14 (W+M)

| Decisão | Opções | Quem destrava |
|---|---|---|
| O que vem primeiro | CSVs do PSI (medições) ou etapas 3 a 9 do NTRS (PDFs, chunking) | W+M, depois de ler o enunciado final |
| Provedor e modelo do resumo | definido até 13/11 (seção 0) | W+M |
| Embeddings no `pgvector` | só quando houver texto real em `document_chunks` | W |
| Escopo do MCP de verdade | ferramentas e linguagem | M |
| Catálogo além de `combustion` | outros termos de busca no PSI | W, conforme o enunciado |
