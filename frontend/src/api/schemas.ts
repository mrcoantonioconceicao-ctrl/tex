// Validação em tempo de execução das respostas da API.
// `satisfies` garante que cada schema continua compatível com o tipo em ./types:
// se um dos dois mudar sem o outro, o build quebra.
import { z } from 'zod'
import type {
  CombustionTelemetry,
  McpContextResponse,
  PredictionReport,
  SystemPerformanceMetrics,
} from './types'

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

// ---- Relatório de predições (simulation/predicoes.py) ----

const probabilitySchema = z.number().min(0).max(1)

export const predictionReportSchema = z.object({
  schema_version: z.literal(1),
  generated_by: z.string(),
  seed: z.number().int(),
  smac_co: z.object({
    limit_1h_ppm: z.number().positive(),
    limit_24h_ppm: z.number().positive(),
    source: z.string(),
    divergence: z.string(),
  }),
  reference_tests: z.array(
    z.object({
      test_id: z.string(),
      material: z.string(),
      specimen: z.string(),
      pressure_kpa: z.number(),
      o2_pct: z.number(),
      free_volume_m3: z.number(),
      burn_time_s: z.number(),
      delta_co_ppm: z.number(),
      origin_category: originCategorySchema,
      source: z.string(),
    }),
  ),
  not_ignited: z.array(z.object({ material: z.string(), test: z.string(), source: z.string() })),
  model: z.object({
    description: z.string(),
    coefficients_ppm_per_o2_pct: z.record(z.string(), z.number()),
    coefficient_sigma: z.number(),
    hypotheses: z.array(z.string()),
    origin_category: originCategorySchema,
  }),
  fit_check: z.array(
    z.object({
      test_id: z.string(),
      measured_ppm: z.number(),
      predicted_ppm: z.number(),
      error_pct: z.number(),
    }),
  ),
  projections: z.array(
    z.object({
      material: z.string(),
      o2_pct: z.number(),
      samples: z.number().int().positive(),
      co_p05_ppm: z.number(),
      co_p50_ppm: z.number(),
      co_p95_ppm: z.number(),
      prob_exceeds_24h: probabilitySchema,
      prob_exceeds_1h: probabilitySchema,
      risk_level: z.enum(['WITHIN_SMAC', 'EXCEEDS_SMAC_24H', 'EXCEEDS_SMAC_1H']),
      origin_category: originCategorySchema,
      quality_status: z.enum(['EXTRACTED', 'PENDING_VALIDATION', 'VALIDATED', 'REJECTED']),
    }),
  ),
}) satisfies z.ZodType<PredictionReport>
