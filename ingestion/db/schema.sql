-- Schema da ingestão (PostgreSQL 16 + pgvector).
-- Segue o schema mínimo obrigatório do CLAUDE.md: extensões são permitidas, remoções não.
-- Executado só na PRIMEIRA subida do container (volume vazio).
-- Para recriar do zero (apaga os dados): make db-reset, na raiz do repositório.

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Documentos e autores (NTRS hoje; PSI depois)
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  document_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_ntrs            BIGINT UNIQUE,                    -- NULL para documentos de outras fontes
  title              TEXT NOT NULL,
  canonical_url      TEXT NOT NULL,                    -- página pública do documento na fonte
  pdf_hash           TEXT CHECK (pdf_hash ~ '^[0-9a-f]{64}$'),  -- SHA-256 do PDF (etapa 4 do pipeline)
  -- Extensões
  source             TEXT NOT NULL DEFAULT 'NTRS',
  abstract           TEXT,
  sti_type           TEXT,                             -- ex.: PRESENTATION, CONFERENCE_PAPER
  center_code        TEXT,                             -- ex.: GRC
  center_name        TEXT,
  distribution_date  TIMESTAMPTZ,
  submitted_date     TIMESTAMPTZ,
  modified_at        TIMESTAMPTZ,
  keywords           TEXT[] NOT NULL DEFAULT '{}',
  subject_categories TEXT[] NOT NULL DEFAULT '{}',
  pdf_url            TEXT,
  fulltext_url       TEXT,
  raw                JSONB NOT NULL,                   -- registro original da fonte: nunca descartar
  ingested_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_keywords_idx ON documents USING GIN (keywords);
CREATE INDEX IF NOT EXISTS documents_center_idx ON documents (center_code);

-- Autor é tabela própria: vira nó do grafo do GraphRAG
CREATE TABLE IF NOT EXISTS authors (
  author_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE                       -- grafia exata da fonte (desambiguação fica para depois)
);

CREATE TABLE IF NOT EXISTS document_authors (
  document_id  BIGINT NOT NULL REFERENCES documents (document_id) ON DELETE CASCADE,
  author_id    BIGINT NOT NULL REFERENCES authors (author_id),
  sequence     INTEGER NOT NULL,                       -- ordem de autoria na fonte
  organization TEXT,                                   -- afiliação na época do documento
  location     TEXT,
  PRIMARY KEY (document_id, sequence)
);

CREATE INDEX IF NOT EXISTS document_authors_author_idx ON document_authors (author_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  chunk_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id  BIGINT NOT NULL REFERENCES documents (document_id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  page_number  INTEGER CHECK (page_number > 0),
  section      TEXT
  -- A coluna embedding vector(N) entra quando o modelo de embeddings for escolhido:
  -- a dimensão N depende do modelo.
);

CREATE INDEX IF NOT EXISTS document_chunks_document_idx ON document_chunks (document_id);

-- ============================================================
-- Experimentos (FLEX/FLEX-2, ACME, Saffire, BASS)
-- ============================================================

CREATE TABLE IF NOT EXISTS experiments (
  experiment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  program       TEXT NOT NULL CHECK (program IN ('FLEX', 'ACME', 'Saffire', 'BASS'))  -- FLEX-2 entra como FLEX
);

CREATE TABLE IF NOT EXISTS document_experiments (
  document_id   BIGINT NOT NULL REFERENCES documents (document_id) ON DELETE CASCADE,
  experiment_id BIGINT NOT NULL REFERENCES experiments (experiment_id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, experiment_id)
);

CREATE TABLE IF NOT EXISTS materials (
  material_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                  TEXT NOT NULL,
  standard_nomenclature TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS experimental_runs (
  run_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  experiment_id BIGINT NOT NULL REFERENCES experiments (experiment_id),
  run_date      DATE,
  notes         TEXT,
  -- Extensão: liga EXECUÇÃO -> MATERIAL (sem isso o caminho do grafo não fecha)
  material_id   BIGINT REFERENCES materials (material_id)
);

CREATE TABLE IF NOT EXISTS experiment_conditions (
  condition_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id           BIGINT NOT NULL REFERENCES experimental_runs (run_id) ON DELETE CASCADE,
  -- % em volume (0 a 100). Decisão Tex Labs: conferir a unidade em cada fonte antes de gravar.
  o2_concentration NUMERIC CHECK (o2_concentration BETWEEN 0 AND 100),
  flow_velocity_ms NUMERIC CHECK (flow_velocity_ms >= 0),
  pressure_atm     NUMERIC CHECK (pressure_atm > 0)
);

-- ============================================================
-- Medições, com linhagem
-- ============================================================

CREATE TABLE IF NOT EXISTS measurements (
  measurement_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id               BIGINT NOT NULL REFERENCES experimental_runs (run_id) ON DELETE CASCADE,
  variable             TEXT NOT NULL,
  value                DOUBLE PRECISION,               -- NULL = ausente na série (não inventar valor)
  unit                 TEXT NOT NULL,
  elapsed_time_seconds DOUBLE PRECISION,
  source_document_id   BIGINT REFERENCES documents (document_id),
  source_page          INTEGER CHECK (source_page > 0),
  quality_status       TEXT NOT NULL DEFAULT 'EXTRACTED'
    CHECK (quality_status IN ('EXTRACTED', 'PENDING_VALIDATION', 'VALIDATED', 'REJECTED')),
  origin_category      TEXT NOT NULL
    CHECK (origin_category IN ('Measured', 'Published', 'Derived', 'Inferred', 'Synthetic')),
  -- Dado publicado precisa citar o documento de onde saiu
  CHECK (origin_category <> 'Published' OR source_document_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS measurements_run_variable_idx ON measurements (run_id, variable);

-- ============================================================
-- Auditoria da coleta
-- ============================================================

-- Uma linha por execução do script: o que foi coletado, quando e com qual resultado
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id          SERIAL PRIMARY KEY,
  source      TEXT NOT NULL,                           -- ex.: ntrs
  query       TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  fetched     INTEGER NOT NULL DEFAULT 0,
  upserted    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
  error       TEXT
);
