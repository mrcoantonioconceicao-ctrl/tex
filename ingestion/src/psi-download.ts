// Download das tabelas experimentais (CSV) do PSI: passo 3 do docs/conhecimento/psi.md.
// Pronto antes de 14/11 e testado só com dado sintético (decisão de Willian e Marco em
// 31/10); a CLI (psi-download-cli.ts) recusa baixar antes de 14/11.
//
// Fluxo por arquivo: pede ao PSI o link S3 assinado e temporário, baixa, confere o
// tamanho com o metadado, calcula o SHA-256, grava em disco e marca o arquivo no banco
// (experiment_files.sha256 e downloaded_at). Um arquivo com problema não derruba os outros.
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fetchWithRetry, type RetryOptions } from './ntrs.ts'
import { PSI_BASE_URL } from './psi.ts'

// Regra da NASA: nada de dado do desafio antes do início do hackathon (horário de Brasília)
export const DOWNLOADS_ALLOWED_FROM = new Date('2026-11-14T00:00:00-03:00')
// As 25 tabelas somam uns 230 KB; arquivo acima disso não é tabela (dado bruto soma 14 TB)
export const MAX_CSV_BYTES = 5 * 1024 * 1024
export const EXPERIMENTAL_TABLE = 'Experimental table'

const USER_AGENT = 'tex-labs-ingestion (NASA Space Apps Challenge 2026)'
const RETRY_LABEL = 'PSI'
const ACCESSION_PATTERN = /^PSI-\d+$/
// Chaves aceitas para o link na resposta JSON (formato ainda não conferido; ver parseSignedLink)
const LINK_KEYS = ['url', 'link', 'signedUrl', 'signed_url', 'href'] as const

export interface PendingFile {
  fileId: number
  accession: string
  version: number | null
  fileName: string
  fileBytes: number | null
}

export interface DownloadedCsv {
  bytes: Uint8Array
  sha256: string
  size: number
}

export type FileOutcome =
  | { ok: true; file: PendingFile; sha256: string; savedTo: string }
  | { ok: false; file: PendingFile; reason: string }

export interface DownloadDeps {
  fetchImpl?: typeof fetch
  retry?: RetryOptions
  dataDir: string
  save: (filePath: string, bytes: Uint8Array) => Promise<void>
  markDownloaded: (fileId: number, sha256: string) => Promise<void>
}

export function isDownloadAllowed(now: Date = new Date()): boolean {
  return now.getTime() >= DOWNLOADS_ALLOWED_FROM.getTime()
}

export function buildDownloadLinkUrl(accession: string, fileName: string, version: number): string {
  const params = new URLSearchParams({ file: fileName, version: String(version), redirect: 'false' })
  return `${PSI_BASE_URL}/studies/${encodeURIComponent(accession)}/download?${params}`
}

// HIPÓTESE: o psi.md só diz que a rota "devolve um link S3 assinado"; o formato exato da
// resposta não foi conferido (pedir o link já é coletar dado do desafio). Aceita texto puro,
// string JSON ou objeto com uma das LINK_KEYS, e só aceita https. Conferir no dia 14.
export function parseSignedLink(body: string): string {
  const candidate = linkCandidate(body)
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`resposta do PSI sem link reconhecível: ${body.slice(0, 200)}`)
  }
  if (url.protocol !== 'https:') throw new Error(`link do PSI fora de https: ${url.protocol}`)
  return url.toString()
}

function linkCandidate(body: string): string {
  const text = body.trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return text
  }
  if (typeof parsed === 'string') return parsed
  if (typeof parsed === 'object' && parsed !== null) {
    for (const key of LINK_KEYS) {
      const value: unknown = Reflect.get(parsed, key)
      if (typeof value === 'string') return value
    }
  }
  return text
}

// Caminho local seguro: o nome vem da API, então nada de separador nem ".."
export function localPath(dataDir: string, accession: string, fileName: string): string {
  if (!ACCESSION_PATTERN.test(accession)) throw new Error(`código fora do formato PSI-<número>: ${accession}`)
  const unsafe = fileName !== path.basename(fileName) || /[\\/]/.test(fileName) || fileName.startsWith('.')
  if (unsafe || fileName.trim() === '') throw new Error(`nome de arquivo recusado: ${fileName}`)
  return path.join(dataDir, accession, fileName)
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function requestSignedLink(
  file: PendingFile,
  version: number,
  fetchImpl: typeof fetch,
  retry: RetryOptions,
): Promise<string> {
  const url = buildDownloadLinkUrl(file.accession, file.fileName, version)
  const init = { headers: { accept: 'application/json, text/plain', 'user-agent': USER_AGENT } }
  const response = await fetchWithRetry(url, init, fetchImpl, { label: RETRY_LABEL, ...retry })
  if (!response.ok) throw new Error(`PSI respondeu ${response.status} ao pedir o link`)
  return parseSignedLink(await response.text())
}

export async function downloadCsv(
  url: string,
  expectedBytes: number | null,
  fetchImpl: typeof fetch = fetch,
  retry: RetryOptions = {},
): Promise<DownloadedCsv> {
  // O link é assinado: sem cabeçalhos extras que possam mudar a assinatura
  const response = await fetchWithRetry(url, {}, fetchImpl, { label: RETRY_LABEL, ...retry })
  if (!response.ok) throw new Error(`download respondeu ${response.status}`)
  const declared = Number(response.headers.get('content-length'))
  if (declared > MAX_CSV_BYTES) throw new Error(`arquivo de ${declared} bytes passa do limite de ${MAX_CSV_BYTES}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_CSV_BYTES) {
    throw new Error(`arquivo de ${bytes.byteLength} bytes passa do limite de ${MAX_CSV_BYTES}`)
  }
  if (expectedBytes !== null && bytes.byteLength !== expectedBytes) {
    throw new Error(`tamanho ${bytes.byteLength} diferente do metadado do PSI (${expectedBytes})`)
  }
  return { bytes, sha256: sha256Hex(bytes), size: bytes.byteLength }
}

async function downloadOne(file: PendingFile, deps: DownloadDeps): Promise<FileOutcome> {
  const { fetchImpl = fetch, retry = {} } = deps
  if (file.version === null) return { ok: false, file, reason: 'investigação sem psi_version no banco' }
  try {
    const savedTo = localPath(deps.dataDir, file.accession, file.fileName)
    const link = await requestSignedLink(file, file.version, fetchImpl, retry)
    const csv = await downloadCsv(link, file.fileBytes, fetchImpl, retry)
    await deps.save(savedTo, csv.bytes)
    await deps.markDownloaded(file.fileId, csv.sha256)
    return { ok: true, file, sha256: csv.sha256, savedTo }
  } catch (error) {
    return { ok: false, file, reason: error instanceof Error ? error.message : String(error) }
  }
}

// Um por vez, com pausa: API pública, e o link assinado expira rápido
export async function downloadPending(
  files: readonly PendingFile[],
  deps: DownloadDeps,
  delayMs = 300,
): Promise<FileOutcome[]> {
  const outcomes: FileOutcome[] = []
  for (const [index, file] of files.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    outcomes.push(await downloadOne(file, deps))
  }
  return outcomes
}
