// Ingestão NTRS -> PostgreSQL.
//   npm run ingest:ntrs -- --dry-run                 (só busca e mostra, sem banco)
//   npm run ingest:ntrs -- --query "flame spread" --max 100
// DATABASE_URL sobrescreve o banco padrão (Postgres do docker-compose.yml).
import { parseArgs } from 'node:util'
import pg from 'pg'
import { DEFAULT_DATABASE_URL, finishRun, startRun, upsertDocuments } from './db.ts'
import { iterateSearch, type SearchPage } from './ntrs.ts'

const HELP = `Uso: npm run ingest:ntrs -- [opções]
  -q, --query <texto>    termo de busca no NTRS (padrão: "microgravity combustion")
  -m, --max <n>          máximo de registros (padrão: 50)
      --page-size <n>    registros por página (padrão: 25)
      --dry-run          busca e mostra, sem gravar no banco
  -h, --help             esta ajuda`

function positiveInt(value: string, name: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} precisa ser inteiro positivo (recebido: ${value})`)
  return n
}

function logPage(page: SearchPage): void {
  console.log(`  página: ${page.received} recebidos, ${page.rows.length} válidos, ${page.rejected.length} rejeitados`)
  for (const r of page.rejected) console.log(`  ✘ rejeitado (índice ${r.index}, id ${String(r.id)}):\n${r.reason}`)
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      query: { type: 'string', short: 'q', default: 'microgravity combustion' },
      max: { type: 'string', short: 'm', default: '50' },
      'page-size': { type: 'string', default: '25' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) {
    console.log(HELP)
    return
  }

  const query = values.query
  const max = positiveInt(values.max, 'max')
  const pageSize = positiveInt(values['page-size'], 'page-size')
  console.log(`NTRS: "${query}" (até ${max} registros, ${pageSize} por página)${values['dry-run'] ? ' [dry-run]' : ''}`)

  if (values['dry-run']) {
    for await (const page of iterateSearch({ query, max, pageSize })) {
      console.log(`  total no NTRS: ${page.total}`)
      logPage(page)
      for (const row of page.rows) console.log(`  · ${row.id}  ${row.title}`)
    }
    return
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL })
  await client.connect()
  const runId = await startRun(client, 'ntrs', query)
  let fetched = 0
  let upserted = 0
  try {
    for await (const page of iterateSearch({ query, max, pageSize })) {
      logPage(page)
      fetched += page.received
      upserted += await upsertDocuments(client, page.rows)
    }
    await finishRun(client, runId, { fetched, upserted, status: 'ok' })
    console.log(`✔ execução #${runId}: ${fetched} recebidos, ${upserted} gravados`)
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
