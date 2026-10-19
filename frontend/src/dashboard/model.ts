// Regras do painel, sem React: classificação de risco, estado da conexão,
// histórico de leituras e formatação. Tudo puro para ser testado isolado.
import type { CombustionTelemetry, RiskLevel } from '../api/types'

// ---- Risco ----

export type RiskTone = 'ok' | 'warning' | 'critical' | 'unknown'

export interface RiskInfo {
  tone: RiskTone
  label: string
  description: string
}

const KNOWN_RISKS: Record<string, RiskInfo> = {
  NOMINAL: {
    tone: 'ok',
    label: 'Nominal',
    description: 'Temperatura dentro do limite seguro, sem supressão.',
  },
  MODERATE_WARNING: {
    tone: 'warning',
    label: 'Alerta moderado',
    description: 'Combustão sob monitoramento, sem supressão ativa.',
  },
  CRITICAL_SUPPRESSION_ACTIVE: {
    tone: 'critical',
    label: 'Crítico: supressão ativa',
    description: 'Supressão ativa: resfriando a câmara e reduzindo o oxigênio até voltar a 870 °C.',
  },
}

export function describeRisk(level: RiskLevel): RiskInfo {
  return (
    KNOWN_RISKS[level] ?? {
      tone: 'unknown',
      label: 'Nível não reconhecido',
      description: `O backend enviou "${level}", que o painel ainda não conhece.`,
    }
  )
}

// Limiares da simulação do backend (src/simulation.rs): acima de 900 °C a supressão
// liga; acima de 870 °C o risco é moderado e é onde a supressão desliga.
// NÃO são limites oficiais da NASA.
export const TEMPERATURE_THRESHOLDS = [
  { value: 900, label: '900 °C: supressão automática' },
  { value: 870, label: '870 °C: alerta / fim da supressão' },
]

// ---- Conexão ----

// 'error' cobre sem conexão, erro HTTP e resposta fora do contrato
export type ConnectionStatus = 'connecting' | 'live' | 'stale' | 'error'

// Sem atualização por este número de ciclos de polling, o dado é tratado como velho
export const STALE_AFTER_POLLS = 3

export interface ConnectionInput {
  hasData: boolean
  isError: boolean
  updatedAt: number
  now: number
  pollMs: number
}

export function connectionStatus({ hasData, isError, updatedAt, now, pollMs }: ConnectionInput): ConnectionStatus {
  if (isError) return 'error'
  if (!hasData) return 'connecting'
  return now - updatedAt > pollMs * STALE_AFTER_POLLS ? 'stale' : 'live'
}

export function secondsSince(timestamp: number, now: number): number {
  return Math.max(0, Math.floor((now - timestamp) / 1000))
}

// ---- Histórico ----

export interface Reading {
  at: number
  experimentId: string
  temperature: number
  oxygen: number
  flameSpread: number
}

export const HISTORY_WINDOW_MS = 5 * 60_000

export function toReading(telemetry: CombustionTelemetry, at: number): Reading {
  return {
    at,
    experimentId: telemetry.experiment_id,
    temperature: telemetry.chamber_temperature_c,
    oxygen: telemetry.oxygen_concentration_pct,
    flameSpread: telemetry.flame_spread_rate_mm_s,
  }
}

// Acrescenta a leitura mantendo só a janela recente. Leitura repetida ou fora de
// ordem é ignorada; troca de experimento recomeça o histórico (não misturar séries).
export function appendReading(history: Reading[], reading: Reading, windowMs = HISTORY_WINDOW_MS): Reading[] {
  const last = history[history.length - 1]
  if (last && reading.at <= last.at) return history
  if (last && last.experimentId !== reading.experimentId) return [reading]
  const cutoff = reading.at - windowMs
  return [...history.filter((r) => r.at >= cutoff), reading]
}

// ---- Gráfico ----

// Faixa do eixo Y cobrindo valores e limiares, com folga de 10%
export function chartDomain(values: number[], extra: number[] = []): [number, number] {
  const all = [...values, ...extra]
  const min = Math.min(...all)
  const max = Math.max(...all)
  if (min === max) return [min - 1, max + 1]
  const pad = (max - min) * 0.1
  return [min - pad, max + pad]
}

// ---- Formatação ----

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`
}
