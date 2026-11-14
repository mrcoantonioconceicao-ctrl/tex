// Testes, condições e medições SINTÉTICOS no contrato de
// GET /investigations/{accession}/runs e GET /conditions/coverage (docs/api-spec.yaml).
// Códigos PSI-9xxx não existem no PSI e tudo sai como Synthetic: os valores só imitam
// o formato das tabelas reais, não são dados da NASA.
import type {
  ConditionCoverage,
  ConditionCoverageList,
  CoverageEnvelope,
  ExperimentalRun,
  Measurement,
  QualityStatus,
  RunPage,
  TestConditions,
  VariableSummary,
} from '../api/types'
import { ACCESSION_PATTERN } from '../api/schemas'
import { boundedInt, invalid, MOCK_INVESTIGATIONS, type MockResult } from './investigations'

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 500
const VARIABLE_PATTERN = /^[a-z][a-z0-9_]*$/
const SYNTHETIC_SHA256 = '0'.repeat(64)

type Value = [variable: string, value: number | null, unit: string, quality?: QualityStatus]

function run(
  accession: string,
  label: string,
  sample: string,
  conditions: Partial<TestConditions> | null,
  values: Value[],
  outcome: string | null = null,
): ExperimentalRun {
  const measurements: Measurement[] = values.map(([variable, value, unit, quality]) => ({
    variable,
    value,
    unit,
    elapsed_time_seconds: null,
    quality_status: quality ?? 'EXTRACTED',
    origin_category: 'Synthetic',
  }))
  const raw: Record<string, string> = { Test: label, Sample: sample }
  for (const [variable, value, unit] of values) raw[`${variable} (${unit})`] = value === null ? '' : String(value)
  return {
    test_label: label,
    run_date: '2020-03-10',
    sample_description: sample,
    outcome,
    conditions:
      conditions === null
        ? null
        : { o2_percent: null, pressure_atm: null, flow_velocity_ms: null, diluent: null, flow_direction: null, ...conditions },
    measurements,
    source_file: { file_name: `${accession}_Experimental table_1.csv`, sha256: SYNTHETIC_SHA256 },
    raw,
  }
}

export const MOCK_RUNS: Readonly<Record<string, readonly ExperimentalRun[]>> = {
  'PSI-9001': [
    run('PSI-9001', 'S1', 'Heptano', { o2_percent: 21, pressure_atm: 1, diluent: 'N2' }, [
      ['droplet_initial_diameter', 3.1, 'mm'],
      ['burn_time', 4.2, 's'],
    ], 'Extinction'),
    run('PSI-9001', 'S2', 'Heptano', { o2_percent: 30, pressure_atm: 0.7, diluent: 'He' }, [
      ['droplet_initial_diameter', 2.9, 'mm'],
      ['burn_time', 3.5, 's'],
    ], 'Extinction'),
    run('PSI-9001', 'S3', 'Metanol', { o2_percent: 35, pressure_atm: 0.6, diluent: 'N2' }, [
      ['droplet_initial_diameter', 2.4, 'mm'],
      ['burn_time', null, 's'],
    ], 'Disruption'),
  ],
  'PSI-9002': [
    run('PSI-9002', 'S1', 'Filme de PMMA', { o2_percent: 21.5, flow_velocity_ms: 0.1, flow_direction: 'opposed' }, [
      ['o2_initial', 21.5, '%'],
      ['o2_final', 20.9, '%'],
      ['co_final', 6, 'ppm'],
    ]),
    run('PSI-9002', 'S2', 'Filme de PMMA', { o2_percent: 21.5, flow_velocity_ms: 0.2, flow_direction: 'opposed' }, [
      ['o2_initial', 21.5, '%'],
      ['o2_final', 1.6, '%', 'PENDING_VALIDATION'],
      ['co_final', 40, 'ppm'],
    ]),
  ],
  'PSI-9003': [
    run('PSI-9003', 'S1', 'Etileno', { o2_percent: 40, pressure_atm: 0.6 }, [['adiabatic_flame_temperature', 2600, 'K']]),
    run('PSI-9003', 'S2', 'Etileno', { o2_percent: 21, pressure_atm: 1 }, [['adiabatic_flame_temperature', 2350, 'K']]),
  ],
  'PSI-9004': [
    run('PSI-9004', 'S1', 'Tecido sintético', { flow_velocity_ms: 0.2, flow_direction: 'concurrent' }, [
      ['burn_time', 70, 's'],
    ]),
  ],
}

function summarizeVariables(runs: readonly ExperimentalRun[]): VariableSummary[] {
  const byKey = new Map<string, VariableSummary>()
  for (const m of runs.flatMap((r) => r.measurements)) {
    const key = `${m.variable}|${m.unit}`
    const current = byKey.get(key) ?? { variable: m.variable, unit: m.unit, count: 0, min: null, max: null, pending_count: 0 }
    current.count++
    if (m.quality_status === 'PENDING_VALIDATION') current.pending_count++
    if (m.value !== null) {
      current.min = current.min === null ? m.value : Math.min(current.min, m.value)
      current.max = current.max === null ? m.value : Math.max(current.max, m.value)
    }
    byKey.set(key, current)
  }
  return [...byKey.values()].sort((a, b) => a.variable.localeCompare(b.variable) || a.unit.localeCompare(b.unit))
}

// Mesmas regras do contrato: 400 para parâmetro inválido, 404 para código inexistente,
// lista vazia para investigação sem tabela normalizada
export function listRuns(accession: string, params: URLSearchParams): MockResult<RunPage> {
  if (!ACCESSION_PATTERN.test(accession)) return invalid(`código fora do formato PSI-<número>: ${accession}`)
  if (!MOCK_INVESTIGATIONS.some((i) => i.accession === accession)) {
    return { status: 404, body: { code: 'NOT_FOUND', message: `investigação ${accession} não encontrada` } }
  }
  const variable = params.get('variable')
  if (variable !== null && !VARIABLE_PATTERN.test(variable)) return invalid(`variável inválida: ${variable}`)
  const page = boundedInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER)
  const pageSize = boundedInt(params.get('page_size'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  if (page === null) return invalid('page precisa ser inteiro a partir de 1')
  if (pageSize === null) return invalid(`page_size precisa ser inteiro entre 1 e ${MAX_PAGE_SIZE}`)

  const runs = MOCK_RUNS[accession] ?? []
  const items = runs.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
    ...r,
    measurements: variable === null ? r.measurements : r.measurements.filter((m) => m.variable === variable),
  }))
  return {
    status: 200,
    body: { accession, items, total: runs.length, page, page_size: pageSize, variables: summarizeVariables(runs) },
  }
}

type EnvelopeKey = keyof CoverageEnvelope

const ENVELOPE_LIMITS: Record<EnvelopeKey, (n: number) => boolean> = {
  o2_min: (n) => n >= 0 && n <= 100,
  o2_max: (n) => n >= 0 && n <= 100,
  pressure_min_atm: (n) => n > 0,
  pressure_max_atm: (n) => n > 0,
  flow_min_ms: (n) => n >= 0,
  flow_max_ms: (n) => n >= 0,
}

function parseEnvelope(params: URLSearchParams): CoverageEnvelope | string {
  const envelope: CoverageEnvelope = {}
  for (const key of Object.keys(ENVELOPE_LIMITS) as EnvelopeKey[]) {
    const raw = params.get(key)
    if (raw === null) continue
    const n = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(n) || !ENVELOPE_LIMITS[key](n)) return `${key} fora do limite: ${raw}`
    envelope[key] = n
  }
  const pairs: [EnvelopeKey, EnvelopeKey][] = [
    ['o2_min', 'o2_max'],
    ['pressure_min_atm', 'pressure_max_atm'],
    ['flow_min_ms', 'flow_max_ms'],
  ]
  for (const [min, max] of pairs) {
    const low = envelope[min]
    const high = envelope[max]
    if (low !== undefined && high !== undefined && low > high) return `${min} maior que ${max}`
  }
  return envelope
}

// Teste sem valor numa dimensão filtrada não conta (igual ao NULL do SQL)
function within(value: number | null, min: number | undefined, max: number | undefined): boolean {
  if (min === undefined && max === undefined) return true
  if (value === null) return false
  return (min === undefined || value >= min) && (max === undefined || value <= max)
}

function inEnvelope(c: TestConditions | null, e: CoverageEnvelope): boolean {
  return (
    within(c?.o2_percent ?? null, e.o2_min, e.o2_max) &&
    within(c?.pressure_atm ?? null, e.pressure_min_atm, e.pressure_max_atm) &&
    within(c?.flow_velocity_ms ?? null, e.flow_min_ms, e.flow_max_ms)
  )
}

function rangeOf(values: (number | null)[]): { min: number; max: number } | null {
  const present = values.filter((v): v is number => v !== null)
  return present.length === 0 ? null : { min: Math.min(...present), max: Math.max(...present) }
}

function distinct<T extends string>(values: (T | null)[]): T[] {
  return [...new Set(values.filter((v): v is T => v !== null))].sort()
}

export function conditionCoverage(params: URLSearchParams): MockResult<ConditionCoverageList> {
  const envelope = parseEnvelope(params)
  if (typeof envelope === 'string') return invalid(envelope)
  const filtered = Object.keys(envelope).length > 0
  const items: ConditionCoverage[] = MOCK_INVESTIGATIONS.filter((i) => MOCK_RUNS[i.accession]).map((i) => {
    const runs = MOCK_RUNS[i.accession] ?? []
    const conditions = runs.map((r) => r.conditions)
    return {
      accession: i.accession,
      name: i.name,
      program: i.program,
      run_count: runs.length,
      o2_percent: rangeOf(conditions.map((c) => c?.o2_percent ?? null)),
      pressure_atm: rangeOf(conditions.map((c) => c?.pressure_atm ?? null)),
      flow_velocity_ms: rangeOf(conditions.map((c) => c?.flow_velocity_ms ?? null)),
      diluents: distinct(conditions.map((c) => c?.diluent ?? null)),
      flow_directions: distinct(conditions.map((c) => c?.flow_direction ?? null)),
      matching_runs: filtered ? runs.filter((r) => inEnvelope(r.conditions, envelope)).length : null,
      origin_category: 'Synthetic',
    }
  })
  return { status: 200, body: { items } }
}
