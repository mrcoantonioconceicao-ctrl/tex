// Mocks MSW por cenário (ver ./scenario.ts). NÃO são dados da NASA:
// o cenário 'backend' copia os valores do src/main.rs (que também é mock)
// e os demais são sintéticos, com experiment_id iniciado por SINTETICO.
import { delay, http, HttpResponse } from 'msw'
import type {
  CombustionTelemetry,
  McpContextRequest,
  McpContextResponse,
  SystemPerformanceMetrics,
} from '../api/types'
import { getMockScenario, type MockScenario } from './scenario'

// '*' casa com qualquer origem: URL relativa no navegador, absoluta nos testes
const BASE = '*/api/v1'

const SLOW_MS = 4000

// Valores do initial_telemetry do main.rs
const BACKEND_TELEMETRY: CombustionTelemetry = {
  experiment_id: 'NASA-ISS-CIR-042',
  chamber_temperature_c: 854.5,
  oxygen_concentration_pct: 21.2,
  flame_spread_rate_mm_s: 1.45,
  risk_level: 'MODERATE_WARNING',
}

const CRITICAL_TELEMETRY: CombustionTelemetry = {
  experiment_id: 'SINTETICO-CRIT-001',
  chamber_temperature_c: 915.4,
  oxygen_concentration_pct: 12.0,
  flame_spread_rate_mm_s: 2.1,
  risk_level: 'CRITICAL_SUPPRESSION_ACTIVE',
}

// Valores do get_metrics_handler do main.rs
const BACKEND_METRICS: SystemPerformanceMetrics = {
  system_target: 'NASA Space Apps Challenge 2026 - Microgravidade',
  ast_parsing_latency_us: 14,
  graphrag_query_latency_us: 125,
  token_crusher_efficiency_pct: 35.4,
  memory_safety_guarantee: 'Zero-Cost Abstractions & Zero Garbage Collector (Rust Safe)',
  uptime_status: 'NOMINAL_ACTIVE',
}

const SIM_START: CombustionTelemetry = { ...BACKEND_TELEMETRY, experiment_id: 'SINTETICO-SIM-001' }
// Acima disto a simulação recomeça, para a demo não ficar presa no crítico
const SIM_RESET_ABOVE_C = 960

let sim = { ...SIM_START }
let simStep = 0

export function resetSimulation(): void {
  sim = { ...SIM_START }
  simStep = 0
}

// Mesma regra do laço de background do main.rs, avançando uma vez por requisição
function nextSimulatedReading(): CombustionTelemetry {
  simStep++
  const temperature = sim.chamber_temperature_c + (simStep % 2 === 0 ? 15.2 : -8.5)
  if (temperature > SIM_RESET_ABOVE_C) {
    resetSimulation()
    return { ...sim }
  }
  sim = { ...sim, chamber_temperature_c: Math.round(temperature * 10) / 10 }
  if (temperature > 900) {
    sim = { ...sim, risk_level: 'CRITICAL_SUPPRESSION_ACTIVE', oxygen_concentration_pct: 12.0 }
  } else if (temperature < 870) {
    sim = { ...sim, risk_level: 'MODERATE_WARNING', oxygen_concentration_pct: 21.0 }
  }
  return { ...sim }
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
      return nextSimulatedReading()
    case 'critico':
      return CRITICAL_TELEMETRY
    case 'fora-do-contrato': {
      // flame_spread_rate_mm_s ausente de propósito
      const broken: Partial<CombustionTelemetry> = { ...BACKEND_TELEMETRY }
      delete broken.flame_spread_rate_mm_s
      return broken
    }
    default:
      return BACKEND_TELEMETRY
  }
}

export const handlers = [
  http.get(`${BASE}/telemetry/latest`, async () => {
    const failure = await applyTransport()
    return failure ?? HttpResponse.json(telemetryFor(getMockScenario()))
  }),

  http.get(`${BASE}/metrics`, async () => {
    const failure = await applyTransport()
    return failure ?? HttpResponse.json<SystemPerformanceMetrics>(BACKEND_METRICS)
  }),

  http.post(`${BASE}/mcp/context`, async ({ request }) => {
    const failure = await applyTransport()
    if (failure) return failure
    const { query } = (await request.json()) as Partial<McpContextRequest>
    const context = `[MOCK] Contexto técnico de segurança para a query '${query ?? 'general_fire_safety'}'.`
    const tokens = context.split(/\s+/).length * 4
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
