-- 0002: investigações do PSI (Physical Sciences Informatics), a fonte de dados
-- indicada no enunciado oficial (docs/conhecimento/enunciado.md e psi.md).
-- Só extensões: nada do schema mínimo é removido.
-- As regras novas entram NOT VALID: valem para o que for gravado daqui em diante
-- sem barrar a migração num banco local que já tenha linhas antigas.

-- ============================================================
-- Programas: o enunciado cita investigações além de FLEX/ACME/Saffire/BASS
-- ============================================================

ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_program_check;
ALTER TABLE experiments ADD CONSTRAINT experiments_program_check
  CHECK (program IN ('FLEX', 'ACME', 'Saffire', 'BASS', 'SAME', 'DAFT', 'SPICE', 'SLICE', 'CFI', 'SoFIE', 'Other'));

-- ============================================================
-- Investigação = experiments + metadados do PSI
-- ============================================================

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS psi_accession     TEXT UNIQUE CHECK (psi_accession ~ '^PSI-\d+$'),
  ADD COLUMN IF NOT EXISTS psi_version       INTEGER CHECK (psi_version > 0),
  ADD COLUMN IF NOT EXISTS title             TEXT,
  ADD COLUMN IF NOT EXISTS project_type      TEXT
    CHECK (project_type IN ('Microgravity Investigation', 'Ground Investigation', 'Reduced Gravity Investigation')),
  ADD COLUMN IF NOT EXISTS sub_research_area TEXT,
  ADD COLUMN IF NOT EXISTS objective         TEXT,             -- base do resumo por IA
  ADD COLUMN IF NOT EXISTS approach          TEXT,
  ADD COLUMN IF NOT EXISTS hypothesis        TEXT,
  ADD COLUMN IF NOT EXISTS hardware          TEXT[] NOT NULL DEFAULT '{}',  -- ex.: CIR, MDCA, MSG
  ADD COLUMN IF NOT EXISTS doi               TEXT,             -- citação exigida pelo PSI
  ADD COLUMN IF NOT EXISTS license           TEXT,             -- ex.: CC0-1.0
  ADD COLUMN IF NOT EXISTS start_date        DATE,
  ADD COLUMN IF NOT EXISTS end_date          DATE,
  ADD COLUMN IF NOT EXISTS total_file_bytes  BIGINT CHECK (total_file_bytes >= 0),
  ADD COLUMN IF NOT EXISTS raw               JSONB,            -- registro original do PSI
  ADD COLUMN IF NOT EXISTS ingested_at       TIMESTAMPTZ;

-- Investigação do PSI sem o registro original é o pior erro de auditoria
ALTER TABLE experiments ADD CONSTRAINT experiments_psi_raw_check
  CHECK (psi_accession IS NULL OR raw IS NOT NULL) NOT VALID;

-- Arquivos da investigação (hoje: as tabelas experimentais em CSV)
CREATE TABLE IF NOT EXISTS experiment_files (
  file_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  experiment_id BIGINT NOT NULL REFERENCES experiments (experiment_id) ON DELETE CASCADE,
  category      TEXT NOT NULL,                       -- ex.: Experimental table
  file_name     TEXT NOT NULL,
  file_bytes    BIGINT CHECK (file_bytes >= 0),
  remote_path   TEXT,                                -- s3_path informado pelo PSI
  sha256        TEXT CHECK (sha256 ~ '^[0-9a-f]{64}$'),  -- preenchido quando o arquivo for baixado
  downloaded_at TIMESTAMPTZ,
  UNIQUE (experiment_id, file_name)
);

-- ============================================================
-- Execuções, condições e medições: lacunas do estudo de 22/10
-- ============================================================

ALTER TABLE experimental_runs
  ADD COLUMN IF NOT EXISTS test_label         TEXT,    -- identificador do teste na fonte (ex.: "B1")
  ADD COLUMN IF NOT EXISTS sample_description TEXT,    -- texto original da amostra (forma e tamanho)
  ADD COLUMN IF NOT EXISTS outcome            TEXT,    -- ex.: ignição, extinção, sem ignição (texto da fonte)
  ADD COLUMN IF NOT EXISTS source_file_id     BIGINT REFERENCES experiment_files (file_id),
  ADD COLUMN IF NOT EXISTS raw                JSONB;   -- linha original do CSV

-- Um teste não pode entrar duas vezes pela mesma tabela de origem (idempotência)
CREATE UNIQUE INDEX IF NOT EXISTS experimental_runs_source_test_idx
  ON experimental_runs (source_file_id, test_label) WHERE source_file_id IS NOT NULL;

ALTER TABLE experiment_conditions
  ADD COLUMN IF NOT EXISTS diluent        TEXT,        -- ex.: N2, CO2, He
  ADD COLUMN IF NOT EXISTS flow_direction TEXT
    CHECK (flow_direction IN ('concurrent', 'opposed', 'quiescent', 'other'));

ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS uncertainty    DOUBLE PRECISION CHECK (uncertainty >= 0),  -- mesma unidade de value
  ADD COLUMN IF NOT EXISTS source_file_id BIGINT REFERENCES experiment_files (file_id);

-- Medição de sensor precisa dizer de qual arquivo veio, como Published diz de qual documento
ALTER TABLE measurements ADD CONSTRAINT measurements_measured_source_check
  CHECK (origin_category <> 'Measured' OR source_file_id IS NOT NULL) NOT VALID;
