// Escrita no PostgreSQL. Tabelas em ../db/schema.sql (schema mínimo do CLAUDE.md).
import type { ClientBase } from 'pg'
import type { CitationRow } from './ntrs.ts'

// Postgres do docker-compose.yml da raiz (credenciais só de desenvolvimento local)
export const DEFAULT_DATABASE_URL = 'postgres://tex:tex@127.0.0.1:5433/tex'

// pdf_hash fica de fora de propósito: é preenchido na coleta do PDF (etapa 4) e
// um novo upsert de metadados não pode apagá-lo.
const UPSERT_DOCUMENT = `
  INSERT INTO documents (
    id_ntrs, title, canonical_url, source, abstract, sti_type, center_code, center_name,
    distribution_date, submitted_date, modified_at,
    keywords, subject_categories, pdf_url, fulltext_url, raw
  ) VALUES ($1, $2, $3, 'NTRS', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
  ON CONFLICT (id_ntrs) DO UPDATE SET
    title = EXCLUDED.title,
    canonical_url = EXCLUDED.canonical_url,
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
    ingested_at = now()
  RETURNING document_id`

// Autor é identificado pela grafia exata da fonte
const INSERT_AUTHORS = `
  INSERT INTO authors (name)
  SELECT DISTINCT unnest($1::text[])
  ON CONFLICT (name) DO NOTHING`

const SELECT_AUTHORS = `SELECT author_id, name FROM authors WHERE name = ANY($1::text[])`

const INSERT_DOCUMENT_AUTHORS = `
  INSERT INTO document_authors (document_id, author_id, sequence, organization, location)
  SELECT $1, * FROM unnest($2::bigint[], $3::int[], $4::text[], $5::text[])`

async function replaceAuthors(client: ClientBase, documentId: string, row: CitationRow): Promise<void> {
  await client.query('DELETE FROM document_authors WHERE document_id = $1', [documentId])
  if (row.authors.length === 0) return

  const names = row.authors.map((a) => a.name)
  await client.query(INSERT_AUTHORS, [names])
  // BIGINT chega do driver como string: mantemos assim para não perder precisão
  const { rows } = await client.query<{ author_id: string; name: string }>(SELECT_AUTHORS, [names])
  const idByName = new Map(rows.map((r) => [r.name, r.author_id]))

  await client.query(INSERT_DOCUMENT_AUTHORS, [
    documentId,
    row.authors.map((a) => idByName.get(a.name)),
    row.authors.map((a) => a.sequence),
    row.authors.map((a) => a.organization),
    row.authors.map((a) => a.location),
  ])
}

// Uma transação por lote: ou a página inteira entra, ou nada entra.
// Reexecutar com os mesmos dados é seguro (upsert + autores regravados).
export async function upsertDocuments(client: ClientBase, rows: CitationRow[]): Promise<number> {
  if (rows.length === 0) return 0
  await client.query('BEGIN')
  try {
    for (const row of rows) {
      const { rows: inserted } = await client.query<{ document_id: string }>(UPSERT_DOCUMENT, [
        row.id,
        row.title,
        row.canonicalUrl,
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
      await replaceAuthors(client, inserted[0].document_id, row)
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
