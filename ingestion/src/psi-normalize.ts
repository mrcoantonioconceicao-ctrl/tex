// Normalização das tabelas experimentais (CSV) do PSI: passo 4 do docs/conhecimento/psi.md.
// Cada linha do CSV vira um experimental_runs (com a linha original no raw), cada célula
// numérica mapeada vira um measurements (Measured + source_file_id) e as colunas de
// O₂, pressão e fluxo viram experiment_conditions nas unidades do schema.
//
// O mapa de colunas é explícito por arquivo (psi-tables.ts): as 25 tabelas não têm
// cabeçalho comum, e adivinhar coluna é o jeito mais fácil de gravar dado errado.
// Célula que não é número limpo (faixa "21.5 - 21.7", lista "21; 26.5", "RAMPED", travessão)
// não vira medição: continua só no raw, sem valor inventado.

export type DateFormat = 'mdy' | 'd-mon-yy' | 'yyddd'
export type QualityStatus = 'EXTRACTED' | 'PENDING_VALIDATION'

export interface ColumnSpec {
  column: string
  variable: string
  // unidade do cabeçalho; ausente = a unidade vem na célula (ex.: "0.27 mm")
  unit?: string
  // fora da faixa física esperada = PENDING_VALIDATION (o valor é gravado como veio)
  range?: readonly [number, number]
  // motivo para revisar a coluna inteira (ex.: unidade do cabeçalho suspeita)
  review?: string
}

export interface ConditionSpec {
  o2?: { column: string; scale: 'percent' | 'mole-fraction' }
  pressure?: { column: string; unit: 'atm' | 'bar' | 'mmHg' }
  flow?: { column: string; unit: 'cm/s' | 'm/s' }
  flowDirection?: string
  // gás -> coluna com a fração; o diluente é o de maior fração (ex.: N2, CO2, He)
  diluent?: Readonly<Record<string, string>>
}

export interface TableMapping {
  testLabel?: string
  date?: { column: string; format: DateFormat }
  sample?: string
  outcome?: string
  measurements: readonly ColumnSpec[]
  conditions?: ConditionSpec
}

export interface NormalizedMeasurement {
  variable: string
  value: number
  unit: string
  quality: QualityStatus
}

export interface NormalizedCondition {
  o2Percent: number | null
  pressureAtm: number | null
  flowMs: number | null
  diluent: string | null
  flowDirection: 'concurrent' | 'opposed' | 'quiescent' | 'other' | null
}

export interface NormalizedRun {
  testLabel: string
  runDate: string | null
  sampleDescription: string | null
  outcome: string | null
  raw: Record<string, string>
  measurements: NormalizedMeasurement[]
  condition: NormalizedCondition | null
}

export interface NormalizedTable {
  runs: NormalizedRun[]
  // células mapeadas que não eram número limpo (ficaram só no raw)
  skippedCells: number
}

export interface ParsedCell {
  value: number
  unit: string | null
  approximate: boolean
}

// ---- Leitura do arquivo ----

// UTF-8 (com ou sem BOM) e, se não for UTF-8 válido, Windows-1252 (caso do FLEX,
// que usa o byte 0x96, travessão (U+2013), como valor ausente)
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

// RFC 4180: aspas, aspas dobradas, quebra de linha dentro de aspas, CRLF ou LF
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// Cabeçalhos do PSI têm espaços sobrando ("Sample Number ", "GMT  Flame Off ")
export function normalizeHeader(header: string): string {
  return header.replace(/\s+/g, ' ').trim()
}

// ---- Células ----

const NUMBER_CELL = /^(~\s*)?([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*(.*)$/i

// "22.2" -> 22.2; ".33 cm" -> 0.33 cm; "~ 21.5" -> 21.5 aproximado.
// Faixa, lista ou texto ("21.5 - 21.7", "21; 26.5", "100% CH4", "RAMPED") -> null
export function parseCell(cell: string): ParsedCell | null {
  const match = NUMBER_CELL.exec(cell.trim())
  if (!match) return null
  const suffix = match[3].trim()
  if (/\d/.test(suffix)) return null
  const value = Number(match[2])
  if (!Number.isFinite(value)) return null
  return { value, unit: suffix === '' ? null : suffix, approximate: match[1] !== undefined }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

// Ano de dois dígitos: todas as investigações do PSI são deste século
function fullYear(text: string): number {
  const year = Number(text)
  return text.length === 2 ? 2000 + year : year
}

export function parseDate(cell: string, format: DateFormat): string | null {
  const text = cell.trim()
  if (format === 'mdy') {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text)
    return m ? isoDate(fullYear(m[3]), Number(m[1]), Number(m[2])) : null
  }
  if (format === 'd-mon-yy') {
    const m = /^(\d{1,2})-([a-z]{3})-(\d{2})$/i.exec(text)
    const month = m ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0
    return m && month > 0 ? isoDate(fullYear(m[3]), month, Number(m[1])) : null
  }
  // YYDDD: ano com dois dígitos + dia do ano (GMT), formato dos testes do ACME
  const m = /^(\d{2})(\d{3})$/.exec(text)
  if (!m) return null
  const dayOfYear = Number(m[2])
  if (dayOfYear < 1 || dayOfYear > 366) return null
  const date = new Date(Date.UTC(fullYear(m[1]), 0, dayOfYear))
  return date.getUTCFullYear() === fullYear(m[1]) ? date.toISOString().slice(0, 10) : null
}

// ---- Tabela ----

type Row = ReadonlyMap<string, string>

// "-" e o travessão (U+2013) são o marcador de vazio das tabelas (ex.: CFI-G e FLEX)
const EMPTY_MARKERS = new Set(['', '-', '\u2013'])

function text(row: Row, column: string | undefined): string | null {
  if (column === undefined) return null
  const value = row.get(column)?.trim() ?? ''
  return EMPTY_MARKERS.has(value) ? null : value
}

// Condição de teste só com valor exato: "~ 21.5" fica como medição a validar, não como condição.
// Unidade da célula só vale se bater com a esperada (célula sem unidade também vale).
function cellInUnit(row: Row, column: string, unit: string): number | null {
  const cell = parseCell(row.get(column) ?? '')
  if (cell === null || cell.approximate || (cell.unit !== null && cell.unit !== unit)) return null
  return cell.value
}

function toMeasurement(row: Row, spec: ColumnSpec): NormalizedMeasurement | null {
  const cell = parseCell(row.get(spec.column) ?? '')
  if (cell === null) return null
  const unit = spec.unit ?? cell.unit
  if (unit === null || (spec.unit !== undefined && cell.unit !== null && cell.unit !== spec.unit)) return null
  const outOfRange = spec.range !== undefined && (cell.value < spec.range[0] || cell.value > spec.range[1])
  const pending = cell.approximate || outOfRange || spec.review !== undefined
  return { variable: spec.variable, value: cell.value, unit, quality: pending ? 'PENDING_VALIDATION' : 'EXTRACTED' }
}

const PRESSURE_TO_ATM = { atm: 1, bar: 1 / 1.01325, mmHg: 1 / 760 } as const
const FLOW_TO_MS = { 'cm/s': 0.01, 'm/s': 1 } as const

function flowDirection(value: string | null): NormalizedCondition['flowDirection'] {
  if (value === null) return null
  const lower = value.toLowerCase()
  if (lower.startsWith('concurrent')) return 'concurrent'
  if (lower.startsWith('opposed')) return 'opposed'
  return 'other'
}

function mainDiluent(row: Row, diluent: Readonly<Record<string, string>> | undefined): string | null {
  if (diluent === undefined) return null
  let best: { gas: string; fraction: number } | null = null
  for (const [gas, column] of Object.entries(diluent)) {
    const fraction = parseCell(row.get(column) ?? '')?.value ?? 0
    if (fraction > 0 && (best === null || fraction > best.fraction)) best = { gas, fraction }
  }
  return best?.gas ?? null
}

function o2Percent(row: Row, spec: ConditionSpec['o2']): number | null {
  if (spec === undefined) return null
  const value = cellInUnit(row, spec.column, spec.scale === 'percent' ? '%' : '')
  if (value === null) return null
  const percent = spec.scale === 'percent' ? value : value * 100
  return percent >= 0 && percent <= 100 ? percent : null
}

// Fora das faixas dos CHECKs do schema = campo nulo (nunca derruba a gravação)
function toCondition(row: Row, spec: ConditionSpec | undefined): NormalizedCondition | null {
  if (spec === undefined) return null
  const pressure = spec.pressure ? cellInUnit(row, spec.pressure.column, spec.pressure.unit) : null
  const flow = spec.flow ? cellInUnit(row, spec.flow.column, spec.flow.unit) : null
  const condition: NormalizedCondition = {
    o2Percent: o2Percent(row, spec.o2),
    pressureAtm: pressure !== null && spec.pressure && pressure > 0 ? pressure * PRESSURE_TO_ATM[spec.pressure.unit] : null,
    flowMs: flow !== null && spec.flow && flow >= 0 ? flow * FLOW_TO_MS[spec.flow.unit] : null,
    diluent: mainDiluent(row, spec.diluent),
    flowDirection: flowDirection(text(row, spec.flowDirection)),
  }
  return Object.values(condition).some((v) => v !== null) ? condition : null
}

function mappedColumns(mapping: TableMapping): string[] {
  const c = mapping.conditions
  return [
    mapping.testLabel,
    mapping.date?.column,
    mapping.sample,
    mapping.outcome,
    ...mapping.measurements.map((m) => m.column),
    c?.o2?.column,
    c?.pressure?.column,
    c?.flow?.column,
    c?.flowDirection,
    ...Object.values(c?.diluent ?? {}),
  ].filter((column): column is string => column !== undefined)
}

// Rótulo do teste na fonte; sem coluna de rótulo (ou repetido) usa a posição do registro
function uniqueLabel(candidate: string | null, index: number, seen: Set<string>): string {
  const record = `registro ${index + 1}`
  const label = candidate === null ? record : seen.has(candidate) ? `${candidate} (${record})` : candidate
  seen.add(label)
  return label
}

export function normalizeTable(csvText: string, mapping: TableMapping): NormalizedTable {
  const [header, ...records] = parseCsv(csvText.replace(/^/, ''))
  if (header === undefined) throw new Error('CSV vazio')
  const columns = header.map(normalizeHeader)
  const missing = mappedColumns(mapping).filter((column) => !columns.includes(column))
  if (missing.length > 0) throw new Error(`colunas do mapa ausentes no CSV: ${missing.join(', ')}`)

  const seen = new Set<string>()
  let skippedCells = 0
  const runs = records.map((record, index): NormalizedRun => {
    const row = new Map(columns.map((column, i) => [column, record[i] ?? '']))
    // raw: cabeçalho original da fonte, sem normalizar
    const raw = Object.fromEntries(header.map((column, i) => [column, record[i] ?? '']))
    const measurements: NormalizedMeasurement[] = []
    for (const spec of mapping.measurements) {
      const measurement = toMeasurement(row, spec)
      if (measurement) measurements.push(measurement)
      else if (text(row, spec.column) !== null) skippedCells++
    }
    const dateCell = mapping.date ? text(row, mapping.date.column) : null
    return {
      testLabel: uniqueLabel(text(row, mapping.testLabel), index, seen),
      runDate: dateCell !== null && mapping.date ? parseDate(dateCell, mapping.date.format) : null,
      sampleDescription: text(row, mapping.sample),
      outcome: text(row, mapping.outcome),
      raw,
      measurements,
      condition: toCondition(row, mapping.conditions),
    }
  })
  return { runs, skippedCells }
}
