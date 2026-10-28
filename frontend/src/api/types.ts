// Contrato da API do backend (Rust/Axum), versão v1.
// Fonte da verdade: docs/api-spec.yaml (implementado em ../../src/api.rs).
// Mudou lá, muda aqui e em schemas.ts.

// Níveis conhecidos hoje; aceitamos qualquer texto para um nível novo não quebrar a tela.
export type RiskLevel =
  | 'NOMINAL'
  | 'MODERATE_WARNING'
  | 'CRITICAL_SUPPRESSION_ACTIVE'
  | (string & {})

// Linhagem do dado; Synthetic = teste, mock ou simulação (único marcador de dado sintético)
export type OriginCategory = 'Measured' | 'Published' | 'Derived' | 'Inferred' | 'Synthetic'

// GET /api/v1/telemetry/latest (também a resposta de /simulation/suppress e /reset)
export interface CombustionTelemetry {
  experiment_id: string
  // RFC 3339 em UTC, ex.: 2026-10-19T22:00:00.000Z
  timestamp: string
  // Ciclo da simulação; volta a 0 no reset
  sequence: number
  chamber_temperature_c: number
  oxygen_concentration_pct: number
  flame_spread_rate_mm_s: number
  risk_level: RiskLevel
  suppression_active: boolean
  origin_category: OriginCategory
}

// GET /api/v1/metrics (últimas medições reais dos componentes)
export interface SystemPerformanceMetrics {
  system_target: string
  ast_parsing_latency_us: number
  graphrag_query_latency_us: number
  token_crusher_efficiency_pct: number
  memory_safety_guarantee: string
  uptime_status: string
  uptime_seconds: number
}

// POST /api/v1/mcp/context
export interface McpContextRequest {
  query: string
}

export interface TokenMetrics {
  original_estimated_tokens: number
  compressed_tokens: number
  compression_efficiency_pct: number
}

export interface McpContextResponse {
  protocol: string
  status: string
  compressed_context: string
  token_metrics: TokenMetrics
  origin_category: OriginCategory
}

// ---- Relatório de predições (não é endpoint) ----
// Arquivo gerado por simulation/predicoes.py em ../data/predicoes.json.
// Mudou lá, muda aqui e em schemas.ts.

export interface SmacCoLimits {
  limit_1h_ppm: number
  limit_24h_ppm: number
  source: string
  divergence: string
}

// Teste publicado (Saffire IV a VI): é fato, com fonte
export interface ReferenceTest {
  test_id: string
  material: string
  specimen: string
  pressure_kpa: number
  o2_pct: number
  free_volume_m3: number
  burn_time_s: number
  delta_co_ppm: number
  origin_category: OriginCategory
  source: string
}

export interface NotIgnitedMaterial {
  material: string
  test: string
  source: string
}

export interface PredictionModel {
  description: string
  coefficients_ppm_per_o2_pct: Record<string, number>
  coefficient_sigma: number
  hypotheses: string[]
  origin_category: OriginCategory
}

export interface FitCheck {
  test_id: string
  measured_ppm: number
  predicted_ppm: number
  error_pct: number
}

export type PredictionRisk = 'WITHIN_SMAC' | 'EXCEEDS_SMAC_24H' | 'EXCEEDS_SMAC_1H'

export type QualityStatus = 'EXTRACTED' | 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED'

// Projeção do modelo: é hipótese (Synthetic)
export interface Projection {
  material: string
  o2_pct: number
  samples: number
  co_p05_ppm: number
  co_p50_ppm: number
  co_p95_ppm: number
  prob_exceeds_24h: number
  prob_exceeds_1h: number
  risk_level: PredictionRisk
  origin_category: OriginCategory
  quality_status: QualityStatus
}

export interface PredictionReport {
  schema_version: 1
  generated_by: string
  seed: number
  smac_co: SmacCoLimits
  reference_tests: ReferenceTest[]
  not_ignited: NotIgnitedMaterial[]
  model: PredictionModel
  fit_check: FitCheck[]
  projections: Projection[]
}
