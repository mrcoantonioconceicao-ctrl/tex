// Contrato PROVISÓRIO da API do backend (Rust/Axum).
// Fonte da verdade: structs em ../../src/main.rs (CombustionTelemetry, McpContextResponse).
// docs/api-spec.yaml está divergente (lista /analysis/graphrag, que não existe no Axum).

// Valores conhecidos hoje; o backend envia String, então aceitamos qualquer texto.
export type RiskLevel =
  | 'MODERATE_WARNING'
  | 'CRITICAL_SUPPRESSION_ACTIVE'
  | (string & {})

// GET /api/v1/telemetry/latest
export interface CombustionTelemetry {
  experiment_id: string
  chamber_temperature_c: number
  oxygen_concentration_pct: number
  flame_spread_rate_mm_s: number
  risk_level: RiskLevel
}

// GET /api/v1/metrics (no backend atual os valores são fixos no handler)
export interface SystemPerformanceMetrics {
  system_target: string
  ast_parsing_latency_us: number
  graphrag_query_latency_us: number
  token_crusher_efficiency_pct: number
  memory_safety_guarantee: string
  uptime_status: string
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
}
