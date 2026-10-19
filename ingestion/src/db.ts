// Escrita no PostgreSQL. Tabelas em ../db/schema.sql.
import type { ClientBase } from 'pg'
import type { CitationRow } from './ntrs.ts'

// Postgres do docker-compose.yml (credenciais só de desenvolvimento local)
export const DEFAULT_DATABASE_URL = 'postgres://tex:tex@127.0.0.1:5433/tex'

const UPSERT_CITATION = `
  INSERT INTO ntrs_citations (
    id, title, abstract, sti_type, center_code, center_name,
    distribution_date, submitted_date, modified_at,
    keywords, subject_categories, pdf_url, fulltext_url, raw
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    abstract = EXCLUDED.abstract,
    sti_type = EXCLUDED.sti_type,
    center_code = EXCLUDED.center_code,
    center_name = EXCLUDED.center_name,
    distribution_date = EXCLUDED.distribution_date,
    submitted_date = EXCLUDED.submitted_date,
    modified_at = EXCLUDED.modified_at,
    keywords = EXCLUDED.keywords,
    subject_categories = EXCLUDED.subject_categories,
    pdf_url = EXCLUDED.pdf_url,
    fulltext_url = EXCLUDED.fulltext_url,
    raw = EXCLUDED.raw,
    ingested_at = now()`

const INSERT_AUTHORS = `
  INSERT INTO ntrs_authors (citation_id, sequence, name, organization, location)
  SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::text[])`

// Uma transação por lote: ou a página inteira entra, ou nada entra.
// Reexecutar com os mesmos dados é seguro (upsert + autores regravados).
export async function upsertCitations(client: ClientBase, rows: CitationRow[]): Promise<number> {
  if (rows.length === 0) return 0
  await client.query('BEGIN')
  try {
    for (const row of rows) {
      await client.query(UPSERT_CITATION, [
        row.id,
        row.title,
        row.abstract,
        row.stiType,
        row.centerCode,
        row.centerName,
        row.distributionDate,
        row.submittedDate,
        row.modifiedAt,
        row.keywords,
        row.subjectCategories,
        row.pdfUrl,
        row.fulltextUrl,
        JSON.stringify(row.raw),
      ])
      await client.query('DELETE FROM ntrs_authors WHERE citation_id = $1', [row.id])
      if (row.authors.length > 0) {
        await client.query(INSERT_AUTHORS, [
          row.id,
          row.authors.map((a) => a.sequence),
          row.authors.map((a) => a.name),
          row.authors.map((a) => a.organization),
          row.authors.map((a) => a.location),
        ])
      }
    }
    await client.query('COMMIT')
    return rows.length
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function startRun(client: ClientBase, source: string, query: string): Promise<number> {
  const result = await client.query<{ id: number }>(
    'INSERT INTO ingestion_runs (source, query) VALUES ($1, $2) RETURNING id',
    [source, query],
  )
  return result.rows[0].id
}

export interface RunOutcome {
  fetched: number
  upserted: number
  status: 'ok' | 'failed'
  error?: string
}

export async function finishRun(client: ClientBase, id: number, outcome: RunOutcome): Promise<void> {
  await client.query(
    `UPDATE ingestion_runs
        SET finished_at = now(), fetched = $2, upserted = $3, status = $4, error = $5
      WHERE id = $1`,
    [id, outcome.fetched, outcome.upserted, outcome.status, outcome.error ?? null],
  )
}
