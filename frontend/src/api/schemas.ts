// Validação em tempo de execução das respostas da API.
// `satisfies` garante que cada schema continua compatível com o tipo em ./types:
// se um dos dois mudar sem o outro, o build quebra.
import { z } from 'zod'
import type { CombustionTelemetry, McpContextResponse } from './types'

export const combustionTelemetrySchema = z.object({
  experiment_id: z.string(),
  chamber_temperature_c: z.number(),
  oxygen_concentration_pct: z.number(),
  flame_spread_rate_mm_s: z.number(),
  risk_level: z.string(),
}) satisfies z.ZodType<CombustionTelemetry>

export const mcpContextResponseSchema = z.object({
  protocol: z.string(),
  status: z.string(),
  compressed_context: z.string(),
  token_metrics: z.object({
    original_estimated_tokens: z.number(),
    compressed_tokens: z.number(),
    compression_efficiency_pct: z.number(),
  }),
}) satisfies z.ZodType<McpContextResponse>
