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
