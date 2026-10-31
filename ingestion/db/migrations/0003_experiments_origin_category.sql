-- 0003: linhagem das investigações (regra do CLAUDE.md: todo dado diz de onde veio).
-- O /api/v1/investigations lê experiments e precisa saber se a linha veio da
-- ingestão do PSI (Published) ou de um teste (Synthetic). Só extensão.

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS origin_category TEXT NOT NULL DEFAULT 'Published'
    CHECK (origin_category IN ('Measured', 'Published', 'Derived', 'Inferred', 'Synthetic'));
