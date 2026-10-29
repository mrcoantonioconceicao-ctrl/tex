// Catálogo SINTÉTICO de investigações no contrato de /api/v1/investigations
// (docs/api-spec.yaml). Códigos PSI-9xxx não existem no PSI: nenhum dado real do
// desafio entra no repositório antes de 14/11. A lógica de filtro e paginação
// replica o que o backend deve fazer, para a tela se comportar igual nos dois modos.
import type {
  ApiErrorBody,
  Investigation,
  InvestigationPage,
  InvestigationSummary,
  Program,
  ProjectType,
} from '../api/types'
import { ACCESSION_PATTERN, programSchema, projectTypeSchema } from '../api/schemas'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const MAX_QUERY_LENGTH = 200

function investigation(
  accession: string,
  name: string,
  program: Program,
  projectType: ProjectType | null,
  fileCount: number,
): Investigation {
  const files = Array.from({ length: fileCount }, (_, i) => ({
    category: 'Experimental table',
    file_name: `${accession}_Experimental table_${i + 1}.csv`,
    file_bytes: 1024 * (i + 1),
    sha256: null,
    downloaded_at: null,
  }))
  return {
    accession,
    name,
    title: `Investigação sintética ${name}`,
    program,
    project_type: projectType,
    sub_research_area: projectType === null ? null : 'Spacecraft Fire Safety',
    hardware: projectType === 'Microgravity Investigation' ? ['Combustion Integrated Rack (CIR)'] : [],
    start_date: projectType === null ? null : '2020-01-15',
    end_date: null,
    file_count: files.length,
    origin_category: 'Synthetic',
    psi_version: 1,
    objective: `Objetivo sintético de ${name}.`,
    approach: null,
    hypothesis: null,
    doi: null,
    license: 'CC0-1.0',
    total_file_bytes: files.reduce((sum, f) => sum + f.file_bytes, 0),
    files,
    ingested_at: '2026-10-28T12:00:00.000Z',
  }
}

export const MOCK_INVESTIGATIONS: readonly Investigation[] = [
  investigation('PSI-9001', 'FLEX-2', 'FLEX', 'Microgravity Investigation', 1),
  investigation('PSI-9002', 'BASS-II', 'BASS', 'Microgravity Investigation', 1),
  investigation('PSI-9003', 'ACME BRE', 'ACME', 'Microgravity Investigation', 2),
  investigation('PSI-9004', 'SAFFIRE-II', 'Saffire', 'Microgravity Investigation', 1),
  investigation('PSI-9005', 'PSI-9005', 'Other', 'Ground Investigation', 0),
  investigation('PSI-9006', 'SAME-R', 'SAME', null, 1),
]

function toSummary(item: Investigation): InvestigationSummary {
  return {
    accession: item.accession,
    name: item.name,
    title: item.title,
    program: item.program,
    project_type: item.project_type,
    sub_research_area: item.sub_research_area,
    hardware: item.hardware,
    start_date: item.start_date,
    end_date: item.end_date,
    file_count: item.file_count,
    origin_category: item.origin_category,
  }
}

export type MockResult<T> = { status: 200; body: T } | { status: 400 | 404; body: ApiErrorBody }

const invalid = (message: string): MockResult<never> => ({
  status: 400,
  body: { code: 'INVALID_PARAMETER', message },
})

// null = parâmetro presente mas inválido; ausente usa o padrão
function boundedInt(raw: string | null, fallback: number, max: number): number | null {
  if (raw === null) return fallback
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null
}

function matchesText(item: Investigation, q: string): boolean {
  const needle = q.toLowerCase()
  return [item.accession, item.name, item.title, item.objective].some((field) =>
    field?.toLowerCase().includes(needle),
  )
}

export function listInvestigations(params: URLSearchParams): MockResult<InvestigationPage> {
  const program = params.get('program')
  if (program !== null && !programSchema.safeParse(program).success) {
    return invalid(`program desconhecido: ${program}`)
  }
  const projectType = params.get('project_type')
  if (projectType !== null && !projectTypeSchema.safeParse(projectType).success) {
    return invalid(`project_type desconhecido: ${projectType}`)
  }
  const q = params.get('q')
  if (q !== null && (q.length === 0 || q.length > MAX_QUERY_LENGTH)) {
    return invalid(`q precisa ter de 1 a ${MAX_QUERY_LENGTH} caracteres`)
  }
  const page = boundedInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER)
  if (page === null) return invalid('page precisa ser inteiro >= 1')
  const pageSize = boundedInt(params.get('page_size'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  if (pageSize === null) return invalid(`page_size precisa ser inteiro entre 1 e ${MAX_PAGE_SIZE}`)

  const matching = MOCK_INVESTIGATIONS.filter(
    (item) =>
      (program === null || item.program === program) &&
      (projectType === null || item.project_type === projectType) &&
      (q === null || matchesText(item, q)),
  )
  const start = (page - 1) * pageSize
  return {
    status: 200,
    body: {
      items: matching.slice(start, start + pageSize).map(toSummary),
      total: matching.length,
      page,
      page_size: pageSize,
    },
  }
}

export function findInvestigation(accession: string): MockResult<Investigation> {
  if (!ACCESSION_PATTERN.test(accession)) {
    return invalid(`código fora do formato PSI-<número>: ${accession}`)
  }
  const item = MOCK_INVESTIGATIONS.find((i) => i.accession === accession)
  return item
    ? { status: 200, body: item }
    : { status: 404, body: { code: 'NOT_FOUND', message: `investigação ${accession} não encontrada` } }
}
