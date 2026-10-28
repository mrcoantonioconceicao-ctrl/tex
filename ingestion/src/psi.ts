// Cliente da API JSON pública do PSI (Physical Sciences Informatics), sem autenticação.
// É a mesma API que o portal psi.nasa.gov usa; formato conferido em 28/10/2026
// (docs/conhecimento/psi.md). Só validamos os campos que usamos; o registro
// original inteiro vai para experiments.raw.
//
// Esqueleto: busca e metadados das investigações (etapas 1, 2, 10 e 11 do pipeline).
// Baixar e normalizar as tabelas experimentais (CSV) fica para depois de 14/11.
import { z } from 'zod'
import { fetchWithRetry, type RetryOptions } from './ntrs.ts'

export const PSI_BASE_URL = 'https://psi.nasa.gov/geode-py/ws'
const USER_AGENT = 'tex-labs-ingestion (NASA Space Apps Challenge 2026)'
const RETRY_LABEL = 'PSI'

// ---- Contrato ----

// O PSI manda "" no lugar de ausente
const optionalText = z
  .string()
  .nullish()
  .transform((value) => (value?.trim() ? value.trim() : null))

const experimentalFileSchema = z.object({
  file_name: z.string().min(1),
  file_size: z.number().int().nonnegative().nullish(),
  s3_path: z.string().nullish(),
})

export const psiInvestigationSchema = z.object({
  accession: z.string().regex(/^PSI-\d+$/),
  version: z.number().int().positive().nullish(),
  title: z.string().min(1),
  investigationAcronym: optionalText,
  projectType: optionalText,
  subResearchArea: optionalText,
  objective: optionalText,
  approach: optionalText,
  hypothesis: optionalText,
  experimentHardware: optionalText,
  doi: optionalText,
  licenseIdentifier: optionalText,
  investigationStartDate: optionalText,
  investigationEndDate: optionalText,
  totalFileSize: z.number().int().nonnegative().nullish(),
  experimentalTable: z.array(experimentalFileSchema).nullish(),
})

export type PsiInvestigation = z.infer<typeof psiInvestigationSchema>

const searchEnvelopeSchema = z.object({
  hits: z.object({
    total: z.number().int().nonnegative(),
    hits: z.array(z.object({ _source: z.object({ Accession: z.string() }) })),
  }),
})

// ---- Linhas para o banco ----

// Mesmo CHECK de experiments.program (migração 0002)
export type Program =
  | 'FLEX' | 'ACME' | 'Saffire' | 'BASS' | 'SAME' | 'DAFT' | 'SPICE' | 'SLICE' | 'CFI' | 'SoFIE' | 'Other'

export type ProjectType = 'Microgravity Investigation' | 'Ground Investigation' | 'Reduced Gravity Investigation'

const PROJECT_TYPES: ReadonlySet<string> = new Set<ProjectType>([
  'Microgravity Investigation',
  'Ground Investigation',
  'Reduced Gravity Investigation',
])

export interface ExperimentFileRow {
  category: string
  fileName: string
  fileBytes: number | null
  remotePath: string | null
}

export interface InvestigationRow {
  accession: string
  version: number | null
  // experiments.name: a sigla, ou o código quando não há sigla (investigações de solo)
  name: string
  program: Program
  title: string
  projectType: ProjectType | null
  subResearchArea: string | null
  objective: string | null
  approach: string | null
  hypothesis: string | null
  hardware: string[]
  doi: string | null
  license: string | null
  startDate: string | null
  endDate: string | null
  totalFileBytes: number | null
  files: ExperimentFileRow[]
  raw: unknown
}

// Ordem importa: FLEX-2 cai em FLEX, ACME CFI-G cai em ACME antes de CFI
const PROGRAM_PREFIXES: [RegExp, Program][] = [
  [/^ACME\b/i, 'ACME'],
  [/^FLEX\b/i, 'FLEX'],
  [/^SAFFIRE\b/i, 'Saffire'],
  [/^BASS\b/i, 'BASS'],
  [/^SAME\b/i, 'SAME'],
  [/^DAFT\b/i, 'DAFT'],
  [/^SPICE\b/i, 'SPICE'],
  [/^SLICE\b/i, 'SLICE'],
  [/^CFI\b/i, 'CFI'],
  [/^SOFIE\b/i, 'SoFIE'],
]

export function programFor(acronym: string | null): Program {
  if (!acronym) return 'Other'
  return PROGRAM_PREFIXES.find(([pattern]) => pattern.test(acronym))?.[1] ?? 'Other'
}

// Datas do PSI vêm como MM-DD-AAAA; devolve AAAA-MM-DD (DATE do Postgres) ou null
export function parsePsiDate(value: string | null): string | null {
  const match = value ? /^(\d{2})-(\d{2})-(\d{4})$/.exec(value) : null
  if (!match) return null
  const [, month, day, year] = match
  const iso = `${year}-${month}-${day}`
  const date = new Date(`${iso}T00:00:00Z`)
  // recusa datas impossíveis, ex.: 02-31-2020
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null
}

// "CIR, MDCA" e "A; B" viram ["CIR", "MDCA"] e ["A", "B"]
export function splitHardware(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/[;,]\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function toInvestigationRow(inv: PsiInvestigation, raw: unknown): InvestigationRow {
  const projectType = inv.projectType && PROJECT_TYPES.has(inv.projectType) ? (inv.projectType as ProjectType) : null
  return {
    accession: inv.accession,
    version: inv.version ?? null,
    name: inv.investigationAcronym ?? inv.accession,
    program: programFor(inv.investigationAcronym),
    title: inv.title,
    projectType,
    subResearchArea: inv.subResearchArea,
    objective: inv.objective,
    approach: inv.approach,
    hypothesis: inv.hypothesis,
    hardware: splitHardware(inv.experimentHardware),
    doi: inv.doi,
    license: inv.licenseIdentifier,
    startDate: parsePsiDate(inv.investigationStartDate),
    endDate: parsePsiDate(inv.investigationEndDate),
    totalFileBytes: inv.totalFileSize ?? null,
    files: (inv.experimentalTable ?? []).map((f) => ({
      category: 'Experimental table',
      fileName: f.file_name,
      fileBytes: f.file_size ?? null,
      remotePath: f.s3_path ?? null,
    })),
    raw,
  }
}

// ---- Chamadas ----

export interface PsiSearchParams {
  term: string
  from: number
  size: number
}

export function buildPsiSearchUrl({ term, from, size }: PsiSearchParams): string {
  const params = new URLSearchParams({ term, source: 'psi', type: 'investigation', from: String(from), size: String(size) })
  return `${PSI_BASE_URL}/repo/search?${params}`
}

export function buildInvestigationUrl(accession: string): string {
  return `${PSI_BASE_URL}/repo/investigations/${encodeURIComponent(accession)}`
}

async function getJson(url: string, fetchImpl: typeof fetch, retry: RetryOptions): Promise<unknown> {
  const init = { headers: { accept: 'application/json', 'user-agent': USER_AGENT } }
  const response = await fetchWithRetry(url, init, fetchImpl, { label: RETRY_LABEL, ...retry })
  if (!response.ok) throw new Error(`PSI respondeu ${response.status} para ${url}`)
  return response.json()
}

export interface PsiSearchPage {
  total: number
  accessions: string[]
}

export async function searchInvestigations(
  params: PsiSearchParams,
  fetchImpl: typeof fetch = fetch,
  retry: RetryOptions = {},
): Promise<PsiSearchPage> {
  const envelope = searchEnvelopeSchema.safeParse(await getJson(buildPsiSearchUrl(params), fetchImpl, retry))
  if (!envelope.success) {
    throw new Error(`PSI respondeu a busca fora do formato esperado:\n${z.prettifyError(envelope.error)}`)
  }
  return {
    total: envelope.data.hits.total,
    accessions: envelope.data.hits.hits.map((hit) => hit._source.Accession),
  }
}

export type InvestigationResult = { ok: true; row: InvestigationRow } | { ok: false; accession: string; reason: string }

// Uma investigação fora do formato vira rejeição, não derruba a coleta inteira
export async function fetchInvestigation(
  accession: string,
  fetchImpl: typeof fetch = fetch,
  retry: RetryOptions = {},
): Promise<InvestigationResult> {
  const raw = await getJson(buildInvestigationUrl(accession), fetchImpl, retry)
  const parsed = psiInvestigationSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, accession, reason: z.prettifyError(parsed.error) }
  return { ok: true, row: toInvestigationRow(parsed.data, raw) }
}
