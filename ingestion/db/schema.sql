-- Schema inicial da ingestão (PostgreSQL 16).
-- Executado automaticamente na PRIMEIRA subida do container (docker-entrypoint-initdb.d).
-- Para recriar do zero (apaga os dados): make db-reset, na raiz do repositório

-- Citações do NASA Technical Reports Server (https://ntrs.nasa.gov)
CREATE TABLE IF NOT EXISTS ntrs_citations (
  id                 BIGINT PRIMARY KEY,          -- id do NTRS (ex.: 20150023100)
  title              TEXT NOT NULL,
  abstract           TEXT,
  sti_type           TEXT,                        -- ex.: PRESENTATION, CONFERENCE_PAPER
  center_code        TEXT,                        -- ex.: GRC
  center_name        TEXT,
  distribution_date  TIMESTAMPTZ,
  submitted_date     TIMESTAMPTZ,
  modified_at        TIMESTAMPTZ,
  keywords           TEXT[] NOT NULL DEFAULT '{}',
  subject_categories TEXT[] NOT NULL DEFAULT '{}',
  pdf_url            TEXT,
  fulltext_url       TEXT,
  raw                JSONB NOT NULL,              -- registro original, para não perder campos
  ingested_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ntrs_citations_keywords_idx ON ntrs_citations USING GIN (keywords);
CREATE INDEX IF NOT EXISTS ntrs_citations_center_idx ON ntrs_citations (center_code);

CREATE TABLE IF NOT EXISTS ntrs_authors (
  citation_id  BIGINT NOT NULL REFERENCES ntrs_citations (id) ON DELETE CASCADE,
  sequence     INTEGER NOT NULL,
  name         TEXT NOT NULL,
  organization TEXT,
  location     TEXT,
  PRIMARY KEY (citation_id, sequence)
);

-- Uma linha por execução do script, para rastrear o que foi coletado e quando
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id          SERIAL PRIMARY KEY,
  source      TEXT NOT NULL,                      -- ex.: ntrs
  query       TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  fetched     INTEGER NOT NULL DEFAULT 0,
  upserted    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'running',    -- running | ok | failed
  error       TEXT
);
