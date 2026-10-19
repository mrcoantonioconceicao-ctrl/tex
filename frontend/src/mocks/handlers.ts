// Mocks MSW por cenário (ver ./scenario.ts), no contrato v1 (docs/api-spec.yaml).
// NÃO são dados da NASA: a simulação replica a física de ../../../src/simulation.rs
// com dados sintéticos, para o modo mock se comportar como o backend real.
import { delay, http, HttpResponse } from 'msw'
import type {
  CombustionTelemetry,
  McpContextRequest,
  McpContextResponse,
  RiskLevel,
  SystemPerformanceMetrics,
} from '../api/types'
import { getMockScenario, type MockScenario } from './scenario'

// '*' casa com qualquer origem: URL relativa no navegador, absoluta nos testes
const BASE = '*/api/v1'

const SLOW_MS = 4000

// ---- Simulação (mesmas constantes de src/simulation.rs) ----

const EXPERIMENT_ID = 'SIM-TEX-001'
const INITIAL_TEMPERATURE_C = 854.5
const INITIAL_OXYGEN_PCT = 21
const FLAME_SPREAD_MM_S = 1.45
const CRITICAL_ABOVE_C = 900
const WARNING_ABOVE_C = 870

interface MockSimulation {
  temperature: number
  oxygen: number
  risk: RiskLevel
  suppression: boolean
  sequence: number
}

function initialSimulation(): MockSimulation {
  return {
    temperature: INITIAL_TEMPERATURE_C,
    oxygen: INITIAL_OXYGEN_PCT,
    risk: 'NOMINAL',
    suppression: false,
    sequence: 0,
  }
}

let sim = initialSimulation()

export function resetMockSimulation(): void {
  sim = initialSimulation()
}

function triggerMockSuppression(): void {
  sim = { ...sim, suppression: true, risk: 'CRITICAL_SUPPRESSION_ACTIVE' }
}

// Um ciclo, como Simulation::step no Rust (aqui avança uma vez por requisição)
function stepSimulation(): void {
  const sequence = sim.sequence + 1
  if (sim.suppression) {
    const temperature = sim.temperature - 18.5
    const oxygen = Math.max(sim.oxygen - 1.2, 12)
    const ended = temperature <= WARNING_ABOVE_C
    sim = {
      temperature,
      oxygen,
      sequence,
      suppression: !ended,
      risk: ended ? 'NOMINAL' : 'CRITICAL_SUPPRESSION_ACTIVE',
    }
    return
  }

  const temperature = sim.temperature + (sequence % 2 === 0 ? 12 : -4)
  const oxygen = Math.min(sim.oxygen + 0.5, 21)
  sim = { ...sim, temperature, oxygen, sequence }
  if (temperature > CRITICAL_ABOVE_C) triggerMockSuppression()
  else sim = { ...sim, risk: temperature > WARNING_ABOVE_C ? 'MODERATE_WARNING' : 'NOMINAL' }
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals

function toTelemetry(state: MockSimulation): CombustionTelemetry {
  return {
    experiment_id: EXPERIMENT_ID,
    timestamp: new Date().toISOString(),
    sequence: state.sequence,
    chamber_temperature_c: round(state.temperature, 1),
    oxygen_concentration_pct: round(state.oxygen, 1),
    flame_spread_rate_mm_s: FLAME_SPREAD_MM_S,
    risk_level: state.risk,
    suppression_active: state.suppression,
  }
}

// ---- Cenários ----

const CRITICAL_TELEMETRY: Omit<CombustionTelemetry, 'timestamp'> = {
  experiment_id: 'SINTETICO-CRIT-001',
  sequence: 0,
  chamber_temperature_c: 912.5,
  oxygen_concentration_pct: 15.4,
  flame_spread_rate_mm_s: FLAME_SPREAD_MM_S,
  risk_level: 'CRITICAL_SUPPRESSION_ACTIVE',
  suppression_active: true,
}

// Valores de exemplo; o backend real devolve as últimas medições dos componentes
const SAMPLE_METRICS: SystemPerformanceMetrics = {
  system_target: 'NASA Space Apps Challenge 2026 - Microgravidade',
  ast_parsing_latency_us: 14,
  graphrag_query_latency_us: 125,
  token_crusher_efficiency_pct: 12.5,
  memory_safety_guarantee: 'Zero-Cost Abstractions & Zero Garbage Collector (Rust Safe)',
  uptime_status: 'NOMINAL_ACTIVE',
  uptime_seconds: 120,
}

// Comportamento comum a todos os endpoints: falha de rede ou atraso
async function applyTransport(): Promise<Response | undefined> {
  const scenario = getMockScenario()
  if (scenario === 'offline') return HttpResponse.error()
  if (scenario === 'lento') await delay(SLOW_MS)
  return undefined
}

// Partial porque o cenário 'fora-do-contrato' omite campo de propósito
function telemetryFor(scenario: MockScenario): Partial<CombustionTelemetry> {
  switch (scenario) {
    case 'simulacao':
      stepSimulation()
      return toTelemetry(sim)
    case 'critico':
      return { ...CRITICAL_TELEMETRY, timestamp: new Date().toISOString() }
    case 'fora-do-contrato': {
      // flame_spread_rate_mm_s ausente de propósito
      const broken: Partial<CombustionTelemetry> = toTelemetry(sim)
      delete broken.flame_spread_rate_mm_s
      return broken
    }
    default:
      // 'backend': leitura parada (como o backend entre dois ciclos); só muda pelos controles
      return toTelemetry(sim)
  }
}

export const handlers = [
  http.get(`${BASE}/telemetry/latest`, async () => {
    const failure = await applyTransport()
    return failure ?? HttpResponse.json(telemetryFor(getMockScenario()))
  }),

  http.get(`${BASE}/metrics`, async () => {
    const failure = await applyTransport()
    return failure ?? HttpResponse.json<SystemPerformanceMetrics>(SAMPLE_METRICS)
  }),

  http.post(`${BASE}/simulation/suppress`, async () => {
    const failure = await applyTransport()
    if (failure) return failure
    triggerMockSuppression()
    return HttpResponse.json<CombustionTelemetry>(toTelemetry(sim))
  }),

  http.post(`${BASE}/simulation/reset`, async () => {
    const failure = await applyTransport()
    if (failure) return failure
    resetMockSimulation()
    return HttpResponse.json<CombustionTelemetry>(toTelemetry(sim))
  }),

  http.post(`${BASE}/mcp/context`, async ({ request }) => {
    const failure = await applyTransport()
    if (failure) return failure
    const { query } = (await request.json()) as Partial<McpContextRequest>
    const context = `[MOCK] Contexto técnico de segurança para a consulta '${query ?? 'general_fire_safety'}'.`
    const tokens = Math.ceil(context.length / 4)
    return HttpResponse.json<McpContextResponse>({
      protocol: 'MCP-Enterprise-v1',
      status: 'ACTIVE_OPTIMIZED',
      compressed_context: context,
      token_metrics: {
        original_estimated_tokens: tokens,
        compressed_tokens: tokens,
        compression_efficiency_pct: 0,
      },
    })
  }),
]
