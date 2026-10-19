// Camada única de acesso à API. Componentes nunca chamam fetch direto:
// trocar mock por API real (ou mudar formato) se resolve só aqui.
import { z } from 'zod'
import { combustionTelemetrySchema, mcpContextResponseSchema } from './schemas'
import type {
  CombustionTelemetry,
  McpContextRequest,
  McpContextResponse,
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

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const label = `${init?.method ?? 'GET'} ${path}`
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
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

export function postMcpContext(body: McpContextRequest): Promise<McpContextResponse> {
  return request('/mcp/context', mcpContextResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
