// Regras de exibição do catálogo de investigações (funções puras, testadas em model.test.ts).
import type { Program, ProjectType } from '../api/types'

export const PAGE_SIZE = 10

// Mesma ordem do api-spec.yaml (Program)
export const PROGRAMS: readonly Program[] = [
  'FLEX',
  'ACME',
  'Saffire',
  'BASS',
  'SAME',
  'DAFT',
  'SPICE',
  'SLICE',
  'CFI',
  'SoFIE',
  'Other',
]

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  'Microgravity Investigation': 'Microgravidade',
  'Ground Investigation': 'Solo',
  'Reduced Gravity Investigation': 'Gravidade reduzida',
}

export const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]

export function programLabel(program: Program): string {
  return program === 'Other' ? 'Outros' : program
}

// AAAA-MM-DD -> DD/MM/AAAA sem passar por Date (evita deslocar o dia pelo fuso)
export function formatDate(isoDate: string | null): string {
  if (isoDate === null) return 'não informada'
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function formatPeriod(start: string | null, end: string | null): string {
  if (start === null && end === null) return 'Período não informado'
  if (end === null) return `Desde ${formatDate(start)}`
  return `${formatDate(start)} a ${formatDate(end)}`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'tamanho não informado'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits })} ${BYTE_UNITS[unit]}`
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

// "11 a 20 de 26"; vazio quando nada casa
export function rangeLabel(page: number, pageSize: number, shown: number, total: number): string {
  if (total === 0) return 'Nenhuma investigação'
  const first = (page - 1) * pageSize + 1
  return `${first} a ${first + shown - 1} de ${total}`
}
