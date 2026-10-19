// Mocks espelhando o backend atual (src/main.rs), que também é mock.
// NÃO são dados da NASA: valores copiados do get_telemetry_handler do Axum.
import { http, HttpResponse } from 'msw'
import type {
  CombustionTelemetry,
  McpContextRequest,
  McpContextResponse,
} from '../api/types'

// '*' casa com qualquer origem: URL relativa no navegador, absoluta nos testes
const BASE = '*/api/v1'

export const handlers = [
  http.get(`${BASE}/telemetry/latest`, () =>
    HttpResponse.json<CombustionTelemetry>({
      experiment_id: 'NASA-ISS-CIR-042',
      chamber_temperature_c: 854.5,
      oxygen_concentration_pct: 21.2,
      flame_spread_rate_mm_s: 1.45,
      risk_level: 'MODERATE_WARNING',
    }),
  ),

  http.post(`${BASE}/mcp/context`, async ({ request }) => {
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
