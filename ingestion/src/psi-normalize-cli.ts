// Normalização das tabelas do PSI já baixadas -> experimental_runs, experiment_conditions
// e measurements (Measured + source_file_id).
//   npm run normalize:psi -- --dry-run             (normaliza e mostra, sem gravar)
//   npm run normalize:psi -- --accession PSI-25
// Roda depois do download:psi. O arquivo em disco precisa ter o mesmo SHA-256 gravado
// no download: arquivo trocado ou corrompido não entra no banco.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import pg from 'pg'
import {
  DEFAULT_DATABASE_URL,
  finishRun,
  listDownloadedTables,
  replaceTableRuns,
  startRun,
  type DownloadedTable,
} from './db.ts'
import { localPath, sha256Hex } from './psi-download.ts'
import { decodeCsv, normalizeTable, type NormalizedTable } from './psi-normalize.ts'
import { PSI_TABLES, PSI_TABLES_SKIPPED, tableKey } from './psi-tables.ts'

const DEFAULT_DATA_DIR = fileURLToPath(new URL('../data/psi/', import.meta.url))

const HELP = `Uso: npm run normalize:psi -- [opções]
  -a, --accession <PSI-n>  só uma investigação (padrão: todas as tabelas baixadas)
  -d, --data-dir <pasta>   onde estão os CSVs (padrão: ingestion/data/psi)
      --dry-run            normaliza e mostra, sem gravar no banco
  -h, --help               esta ajuda`

type TableResult =
  | { status: 'ok'; table: DownloadedTable; normalized: NormalizedTable }
  | { status: 'skipped'; table: DownloadedTable; reason: string }
  | { status: 'failed'; table: DownloadedTable; reason: string }

async function readTable(table: DownloadedTable, dataDir: string): Promise<TableResult> {
  const key = tableKey(table.accession, table.fileName)
  const skipped = PSI_TABLES_SKIPPED[key]
  if (skipped !== undefined) return { status: 'skipped', table, reason: skipped }
  const mapping = PSI_TABLES[key]
  if (mapping === undefined) return { status: 'failed', table, reason: 'sem mapa de colunas em psi-tables.ts' }
  try {
    const bytes = new Uint8Array(await readFile(localPath(dataDir, table.accession, table.fileName)))
    const sha256 = sha256Hex(bytes)
    if (sha256 !== table.sha256) {
      return { status: 'failed', table, reason: `SHA-256 do disco (${sha256.slice(0, 12)}…) difere do download` }
    }
    return { status: 'ok', table, normalized: normalizeTable(decodeCsv(bytes), mapping) }
  } catch (error) {
    return { status: 'failed', table, reason: error instanceof Error ? error.message : String(error) }
  }
}

function summary(normalized: NormalizedTable): string {
  const measurements = normalized.runs.flatMap((run) => run.measurements)
  const pending = measurements.filter((m) => m.quality === 'PENDING_VALIDATION').length
  const conditions = normalized.runs.filter((run) => run.condition !== null).length
  return (
    `${normalized.runs.length} teste(s), ${conditions} condição(ões), ${measurements.length} medição(ões)` +
    ` (${pending} a validar), ${normalized.skippedCells} célula(s) só no raw`
  )
}

async function persist(client: pg.Client, results: TableResult[], query: string): Promise<void> {
  const runId = await startRun(client, 'psi-normalize', query)
  let upserted = 0
  const errors: string[] = results.filter((r) => r.status === 'failed').map((r) => `${r.table.fileName}: ${r.reason}`)
  for (const result of results) {
    if (result.status !== 'ok') continue
    try {
      const outcome = await replaceTableRuns(client, result.table, result.normalized.runs)
      upserted++
      console.log(`  ✔ ${result.table.accession} ${result.table.fileName}: ${outcome.runs} teste(s), ${outcome.measurements} medição(ões) gravados`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      errors.push(`${result.table.fileName}: ${reason}`)
      console.log(`  ✘ ${result.table.accession} ${result.table.fileName}: ${reason}`)
    }
  }
  await finishRun(client, runId, {
    fetched: results.length,
    upserted,
    status: errors.length === 0 ? 'ok' : 'failed',
    error: errors.length === 0 ? undefined : errors.join('; '),
  })
  console.log(`execução #${runId}: ${upserted} de ${results.length} tabela(s) gravada(s)`)
  if (errors.length > 0) process.exitCode = 1
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      accession: { type: 'string', short: 'a' },
      'data-dir': { type: 'string', short: 'd', default: DEFAULT_DATA_DIR },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) {
    console.log(HELP)
    return
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL })
  await client.connect()
  try {
    const tables = await listDownloadedTables(client, values.accession)
    const dryRun = values['dry-run']
    console.log(`PSI: ${tables.length} tabela(s) baixada(s)${dryRun ? ' [dry-run]' : ''}`)
    const results: TableResult[] = []
    for (const table of tables) {
      const result = await readTable(table, values['data-dir'])
      results.push(result)
      const label = `${table.accession} ${table.fileName}`
      if (result.status === 'ok') console.log(`  · ${label}: ${summary(result.normalized)}`)
      else console.log(`  ${result.status === 'skipped' ? '-' : '✘'} ${label}: ${result.reason}`)
    }
    if (dryRun) {
      if (results.some((r) => r.status === 'failed')) process.exitCode = 1
      return
    }
    await persist(client, results, values.accession ?? 'todas')
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
