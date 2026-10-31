// Download das tabelas experimentais (CSV) do PSI -> disco + experiment_files.sha256.
//   npm run download:psi -- --dry-run              (lista o que falta, sem rede)
//   npm run download:psi -- --accession PSI-25
// Roda depois do ingest:psi (que grava a lista de arquivos). Recusa baixar antes de
// 14/11 (regra da NASA); --dry-run funciona sempre, porque só lê o banco.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import pg from 'pg'
import { DEFAULT_DATABASE_URL, finishRun, listPendingFiles, markDownloaded, startRun } from './db.ts'
import { DOWNLOADS_ALLOWED_FROM, downloadPending, isDownloadAllowed, type PendingFile } from './psi-download.ts'

// Fora do git (.gitignore): dado do PSI não entra no repositório
const DEFAULT_DATA_DIR = fileURLToPath(new URL('../data/psi/', import.meta.url))

const HELP = `Uso: npm run download:psi -- [opções]
  -a, --accession <PSI-n>  só uma investigação (padrão: todas com tabela pendente)
  -d, --data-dir <pasta>   onde gravar os CSVs (padrão: ingestion/data/psi)
      --force              baixa de novo o que já tem sha256
      --dry-run            só lista o que seria baixado, sem rede
  -h, --help               esta ajuda`

async function save(filePath: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, bytes)
}

async function download(client: pg.Client, files: PendingFile[], dataDir: string, query: string): Promise<void> {
  const runId = await startRun(client, 'psi-csv', query)
  const outcomes = await downloadPending(files, {
    dataDir,
    save,
    markDownloaded: (fileId, sha256) => markDownloaded(client, fileId, sha256),
  })
  for (const outcome of outcomes) {
    const label = `${outcome.file.accession} ${outcome.file.fileName}`
    console.log(outcome.ok ? `  ✔ ${label} ${outcome.sha256.slice(0, 12)}…` : `  ✘ ${label}: ${outcome.reason}`)
  }
  const failed = outcomes.filter((outcome) => !outcome.ok).length
  const downloaded = outcomes.length - failed
  await finishRun(client, runId, {
    fetched: outcomes.length,
    upserted: downloaded,
    status: failed === 0 ? 'ok' : 'failed',
    error: failed === 0 ? undefined : `${failed} arquivo(s) com falha`,
  })
  console.log(`execução #${runId}: ${downloaded} de ${outcomes.length} baixado(s)`)
  if (failed > 0) process.exitCode = 1
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      accession: { type: 'string', short: 'a' },
      'data-dir': { type: 'string', short: 'd', default: DEFAULT_DATA_DIR },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) {
    console.log(HELP)
    return
  }
  const dryRun = values['dry-run']
  if (!dryRun && !isDownloadAllowed()) {
    throw new Error(`download do PSI só a partir de ${DOWNLOADS_ALLOWED_FROM.toISOString()} (regra da NASA)`)
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL })
  await client.connect()
  try {
    const files = await listPendingFiles(client, { accession: values.accession, force: values.force })
    console.log(`PSI: ${files.length} tabela(s) pendente(s)${dryRun ? ' [dry-run]' : ''}`)
    if (dryRun) {
      for (const f of files) console.log(`  · ${f.accession} v${f.version ?? '?'}  ${f.fileName} (${f.fileBytes ?? '?'} B)`)
      return
    }
    await download(client, files, values['data-dir'], values.accession ?? 'todas')
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
