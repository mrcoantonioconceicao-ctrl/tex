// Formatação comum das telas de medições e cobertura
import { ApiError } from '../api/client'
import type { NumberRange } from '../api/types'

const NUMBER_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

// Travessão (U+2013) e travessão longo (U+2014) por escape: o caractere literal some no editor
const EN_DASH = '\u2013'
export const NO_VALUE = '\u2014'

export function formatNumber(value: number | null): string {
  return value === null ? NO_VALUE : NUMBER_FORMAT.format(value)
}

export function formatRange(range: NumberRange | null): string {
  if (range === null) return NO_VALUE
  if (range.min === range.max) return formatNumber(range.min)
  return `${formatNumber(range.min)}${EN_DASH}${formatNumber(range.max)}`
}

// Enquanto o backend não implementa as rotas do contrato, ele responde 404 de rota
export function routeHint(error: Error): string | null {
  if (error instanceof ApiError && error.code === 'NOT_FOUND') {
    return 'O backend não reconheceu a rota ou a investigação. Confira se ele está atualizado com a main.'
  }
  return null
}
