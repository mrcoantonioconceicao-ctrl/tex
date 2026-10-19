// Validação em tempo de execução das respostas da API.
// `satisfies` garante que cada schema continua compatível com o tipo em ./types:
// se um dos dois mudar sem o outro, o build quebra.
import { z } from 'zod'
import type { CombustionTelemetry, McpContextResponse, SystemPerformanceMetrics } from './types'

const originCategorySchema = z.enum(['Measured', 'Published', 'Derived', 'Inferred', 'Synthetic'])

export const combustionTelemetrySchema = z.object({
  experiment_id: z.string(),
  timestamp: z.iso.datetime(),
  sequence: z.number().int().nonnegative(),
  chamber_temperature_c: z.number(),
  oxygen_concentration_pct: z.number(),
  flame_spread_rate_mm_s: z.number(),
  risk_level: z.string(),
  suppression_active: z.boolean(),
  origin_category: originCategorySchema,
}) satisfies z.ZodType<CombustionTelemetry>

// Latências são u64 no Rust
export const systemPerformanceMetricsSchema = z.object({
  system_target: z.string(),
  ast_parsing_latency_us: z.number().int().nonnegative(),
  graphrag_query_latency_us: z.number().int().nonnegative(),
  token_crusher_efficiency_pct: z.number(),
  memory_safety_guarantee: z.string(),
  uptime_status: z.string(),
  uptime_seconds: z.number().int().nonnegative(),
}) satisfies z.ZodType<SystemPerformanceMetrics>

export const mcpContextResponseSchema = z.object({
  protocol: z.string(),
  status: z.string(),
  compressed_context: z.string(),
  token_metrics: z.object({
    original_estimated_tokens: z.number(),
    compressed_tokens: z.number(),
    compression_efficiency_pct: z.number(),
  }),
  origin_category: originCategorySchema,
}) satisfies z.ZodType<McpContextResponse>
