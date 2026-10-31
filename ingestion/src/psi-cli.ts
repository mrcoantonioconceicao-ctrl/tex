// Ingestão PSI -> PostgreSQL (só metadados das investigações e a lista de arquivos).
//   npm run ingest:psi -- --dry-run                  (só busca e mostra, sem banco)
//   npm run ingest:psi -- --term combustion --max 50
// DATABASE_URL sobrescreve o banco padrão (Postgres do docker-compose.yml).
// Nenhum CSV é baixado aqui: isso é o download:psi (psi-download-cli.ts), a partir de 14/11.
import { parseArgs } from 'node:util'
import pg from 'pg'
import { DEFAULT_DATABASE_URL, finishRun, startRun, upsertInvestigations } from './db.ts'
import { fetchInvestigation, searchInvestigations, type InvestigationRow } from './psi.ts'

const HELP = `Uso: npm run ingest:psi -- [opções]
  -t, --term <texto>     termo de busca no PSI (padrão: "combustion")
  -m, --max <n>          máximo de investigações (padrão: 100)
      --dry-run          busca e mostra, sem gravar no banco
  -h, --help             esta ajuda`

// pausa entre investigações, para não martelar uma API pública
const DELAY_MS = 300

function positiveInt(value: string, name: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} precisa ser inteiro positivo (recebido: ${value})`)
  return n
}

async function collect(term: string, max: number): Promise<{ rows: InvestigationRow[]; fetched: number }> {
  const page = await searchInvestigations({ term, from: 0, size: max })
  console.log(`  total no PSI: ${page.total}, buscando ${page.accessions.length}`)
  const rows: InvestigationRow[] = []
  for (const accession of page.accessions) {
    const result = await fetchInvestigation(accession)
    if (result.ok) rows.push(result.row)
    else console.log(`  ✘ rejeitado (${result.accession}):\n${result.reason}`)
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
  }
  return { rows, fetched: page.accessions.length }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      term: { type: 'string', short: 't', default: 'combustion' },
      max: { type: 'string', short: 'm', default: '100' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) {
    console.log(HELP)
    return
  }

  const term = values.term
  const max = positiveInt(values.max, 'max')
  console.log(`PSI: "${term}" (até ${max} investigações)${values['dry-run'] ? ' [dry-run]' : ''}`)

  if (values['dry-run']) {
    const { rows } = await collect(term, max)
    for (const row of rows) console.log(`  · ${row.accession}  ${row.name} (${row.program})  ${row.files.length} arquivo(s)`)
    return
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL })
  await client.connect()
  const runId = await startRun(client, 'psi', term)
  let fetched = 0
  let upserted = 0
  try {
    const result = await collect(term, max)
    fetched = result.fetched
    upserted = await upsertInvestigations(client, result.rows)
    await finishRun(client, runId, { fetched, upserted, status: 'ok' })
    console.log(`✔ execução #${runId}: ${fetched} recebidas, ${upserted} gravadas`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishRun(client, runId, { fetched, upserted, status: 'failed', error: message })
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
