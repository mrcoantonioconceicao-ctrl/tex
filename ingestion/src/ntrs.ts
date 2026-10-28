// Cliente da API pública do NASA Technical Reports Server (sem autenticação).
// Formato conferido contra respostas reais de /api/citations/search em 19/10/2026.
// Só validamos os campos que usamos; o registro original inteiro vai para a coluna raw.
import { z } from 'zod'

export const NTRS_BASE_URL = 'https://ntrs.nasa.gov'
const USER_AGENT = 'tex-labs-ingestion (NASA Space Apps Challenge 2026)'

// ---- Contrato ----

const authorAffiliationSchema = z.object({
  sequence: z.number().int(),
  meta: z.object({
    author: z.object({ name: z.string() }),
    organization: z.object({ name: z.string().nullish(), location: z.string().nullish() }).nullish(),
  }),
})

const downloadSchema = z.object({
  links: z.object({ pdf: z.string().nullish(), fulltext: z.string().nullish() }).nullish(),
})

// Visto em dado real (19/10/2026): alguns registros trazem o id como string ("77766245676546")
const ntrsIdSchema = z
  .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  .refine((id) => Number.isSafeInteger(id) && id > 0, 'id precisa ser inteiro positivo')

export const ntrsCitationSchema = z.object({
  id: ntrsIdSchema,
  title: z.string().min(1),
  abstract: z.string().nullish(),
  stiType: z.string().nullish(),
  center: z.object({ code: z.string().nullish(), name: z.string().nullish() }).nullish(),
  distributionDate: z.string().nullish(),
  submittedDate: z.string().nullish(),
  modified: z.string().nullish(),
  keywords: z.array(z.string()).nullish(),
  subjectCategories: z.array(z.string()).nullish(),
  authorAffiliations: z.array(authorAffiliationSchema).nullish(),
  downloads: z.array(downloadSchema).nullish(),
})

export type NtrsCitation = z.infer<typeof ntrsCitationSchema>

// Cada resultado é validado à parte: um registro estranho não derruba a página inteira
const searchEnvelopeSchema = z.object({
  stats: z.object({ total: z.number().int().nonnegative() }),
  results: z.array(z.unknown()),
})

// ---- Linhas para o banco ----

export interface AuthorRow {
  sequence: number
  name: string
  organization: string | null
  location: string | null
}

export interface CitationRow {
  id: number
  title: string
  // Página pública do documento (documents.canonical_url)
  canonicalUrl: string
  abstract: string | null
  stiType: string | null
  centerCode: string | null
  centerName: string | null
  distributionDate: Date | null
  submittedDate: Date | null
  modifiedAt: Date | null
  keywords: string[]
  subjectCategories: string[]
  pdfUrl: string | null
  fulltextUrl: string | null
  authors: AuthorRow[]
  raw: unknown
}

// O NTRS manda 7 casas de fração (2019-07-12T00:00:00.0000000+00:00); o Date
// do JS só garante 3, então cortamos antes de converter.
export function parseNtrsDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value.replace(/(\.\d{3})\d+/, '$1'))
  return Number.isNaN(date.getTime()) ? null : date
}

function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return path.startsWith('/') ? `${NTRS_BASE_URL}${path}` : path
}

export function toCitationRow(citation: NtrsCitation, raw: unknown): CitationRow {
  const links = citation.downloads?.find((d) => d.links?.pdf || d.links?.fulltext)?.links
  const authors = new Map<number, AuthorRow>()
  for (const a of citation.authorAffiliations ?? []) {
    if (authors.has(a.sequence)) continue // sequence repetida: fica a primeira
    authors.set(a.sequence, {
      sequence: a.sequence,
      name: a.meta.author.name,
      organization: a.meta.organization?.name ?? null,
      location: a.meta.organization?.location ?? null,
    })
  }
  return {
    id: citation.id,
    title: citation.title,
    canonicalUrl: `${NTRS_BASE_URL}/citations/${citation.id}`,
    abstract: citation.abstract ?? null,
    stiType: citation.stiType ?? null,
    centerCode: citation.center?.code ?? null,
    centerName: citation.center?.name ?? null,
    distributionDate: parseNtrsDate(citation.distributionDate),
    submittedDate: parseNtrsDate(citation.submittedDate),
    modifiedAt: parseNtrsDate(citation.modified),
    keywords: citation.keywords ?? [],
    subjectCategories: citation.subjectCategories ?? [],
    pdfUrl: absoluteUrl(links?.pdf),
    fulltextUrl: absoluteUrl(links?.fulltext),
    authors: [...authors.values()],
    raw,
  }
}

// ---- Busca ----

export interface SearchParams {
  query: string
  from: number
  size: number
}

export function buildSearchUrl({ query, from, size }: SearchParams): string {
  const params = new URLSearchParams({ q: query, 'page.from': String(from), 'page.size': String(size) })
  return `${NTRS_BASE_URL}/api/citations/search?${params}`
}

export interface RejectedRecord {
  index: number
  id: unknown
  reason: string
}

export interface SearchPage {
  total: number
  received: number
  rows: CitationRow[]
  rejected: RejectedRecord[]
}

// ---- Retry ----

export interface RetryOptions {
  // novas tentativas depois da primeira
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  // trocável nos testes, para não esperar de verdade
  sleep?: (ms: number) => Promise<void>
  // nome da fonte nas mensagens (o mesmo retry serve ao PSI)
  label?: string
}

// Falhas passageiras: vale tentar de novo. Um 404, por exemplo, não muda tentando.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Retry-After vem em segundos ou como data HTTP
function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after')
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

// Espera exponencial (base, 2x base, 4x base...), limitada a maxDelayMs; quando o
// servidor manda Retry-After, vale o que ele pediu.
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
  { retries = 3, baseDelayMs = 1000, maxDelayMs = 30_000, sleep = realSleep, label = 'NTRS' }: RetryOptions = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined
    let networkError: unknown
    try {
      response = await fetchImpl(url, init)
    } catch (error) {
      networkError = error
    }

    const retryable = response === undefined || RETRYABLE_STATUS.has(response.status)
    if (!retryable || attempt >= retries) {
      if (response) return response
      const reason = networkError instanceof Error ? networkError.message : String(networkError)
      throw new Error(`${label} sem resposta após ${attempt + 1} tentativa(s): ${reason}`)
    }

    const backoff = baseDelayMs * 2 ** attempt
    const delay = Math.min(maxDelayMs, (response && retryAfterMs(response)) ?? backoff)
    const reason = response ? `HTTP ${response.status}` : 'falha de rede'
    console.warn(`[${label}] tentativa ${attempt + 1} falhou (${reason}); nova tentativa em ${delay} ms`)
    await sleep(delay)
  }
}

export async function fetchSearchPage(
  params: SearchParams,
  fetchImpl: typeof fetch = fetch,
  retry: RetryOptions = {},
): Promise<SearchPage> {
  const url = buildSearchUrl(params)
  const init = { headers: { accept: 'application/json', 'user-agent': USER_AGENT } }
  const response = await fetchWithRetry(url, init, fetchImpl, retry)
  if (!response.ok) throw new Error(`NTRS respondeu ${response.status} para ${url}`)

  const envelope = searchEnvelopeSchema.safeParse(await response.json())
  if (!envelope.success) {
    throw new Error(`NTRS respondeu fora do formato esperado:\n${z.prettifyError(envelope.error)}`)
  }

  const rows: CitationRow[] = []
  const rejected: RejectedRecord[] = []
  envelope.data.results.forEach((raw, index) => {
    const parsed = ntrsCitationSchema.safeParse(raw)
    if (parsed.success) rows.push(toCitationRow(parsed.data, raw))
    else rejected.push({ index, id: (raw as { id?: unknown })?.id, reason: z.prettifyError(parsed.error) })
  })
  return { total: envelope.data.stats.total, received: envelope.data.results.length, rows, rejected }
}

export interface IterateOptions {
  query: string
  max: number
  pageSize: number
  // pausa entre páginas, para não martelar uma API pública
  delayMs?: number
  fetchImpl?: typeof fetch
  retry?: RetryOptions
}

// Percorre as páginas até atingir `max` registros ou acabar o resultado
export async function* iterateSearch({ query, max, pageSize, delayMs = 500, fetchImpl, retry }: IterateOptions) {
  let from = 0
  while (from < max) {
    const size = Math.min(pageSize, max - from)
    const page = await fetchSearchPage({ query, from, size }, fetchImpl, retry)
    yield page
    from += page.received
    if (page.received === 0 || from >= page.total) return
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}
