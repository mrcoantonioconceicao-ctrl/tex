// Camada única de acesso à API. Componentes nunca chamam fetch direto:
// trocar mock por API real (ou mudar formato) se resolve só aqui.
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new ApiError(response.status, `${init?.method ?? 'GET'} ${path} falhou (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function getLatestTelemetry(): Promise<CombustionTelemetry> {
  return request<CombustionTelemetry>('/telemetry/latest')
}

export function postMcpContext(body: McpContextRequest): Promise<McpContextResponse> {
  return request<McpContextResponse>('/mcp/context', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
