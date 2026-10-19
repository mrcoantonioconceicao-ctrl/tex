// Camada única de acesso à API. Componentes nunca chamam fetch direto:
// trocar mock por API real (ou mudar formato) se resolve só aqui.
import { z } from 'zod'
import {
  combustionTelemetrySchema,
  mcpContextResponseSchema,
  systemPerformanceMetricsSchema,
} from './schemas'
import type {
  CombustionTelemetry,
  McpContextRequest,
  McpContextResponse,
  SystemPerformanceMetrics,
} from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Resposta chegou com HTTP ok, mas fora do contrato esperado (campo faltando, tipo errado).
export class ContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractError'
  }
}

// A requisição nem chegou a ter resposta (backend desligado, sem rede, CORS).
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const label = `${init?.method ?? 'GET'} ${path}`
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new NetworkError(`${label} sem conexão com o backend`)
  }
  if (!response.ok) {
    throw new ApiError(response.status, `${label} falhou (${response.status})`)
  }
  const result = schema.safeParse(await response.json())
  if (!result.success) {
    throw new ContractError(`${label} respondeu fora do contrato:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export function getLatestTelemetry(): Promise<CombustionTelemetry> {
  return request('/telemetry/latest', combustionTelemetrySchema)
}

// Controles da simulação (demo): devolvem a leitura logo após a ação
export function triggerSuppression(): Promise<CombustionTelemetry> {
  return request('/simulation/suppress', combustionTelemetrySchema, { method: 'POST' })
}

export function resetSimulation(): Promise<CombustionTelemetry> {
  return request('/simulation/reset', combustionTelemetrySchema, { method: 'POST' })
}

export function getSystemMetrics(): Promise<SystemPerformanceMetrics> {
  return request('/metrics', systemPerformanceMetricsSchema)
}

export function postMcpContext(body: McpContextRequest): Promise<McpContextResponse> {
  return request('/mcp/context', mcpContextResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
