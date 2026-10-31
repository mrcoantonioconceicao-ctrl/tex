// Camada única de acesso à API. Componentes nunca chamam fetch direto:
// trocar mock por API real (ou mudar formato) se resolve só aqui.
import { z } from 'zod'
import predictionReportJson from '../data/predicoes.json'
import {
  aiSummarySchema,
  combustionTelemetrySchema,
  investigationPageSchema,
  investigationSchema,
  mcpContextResponseSchema,
  predictionReportSchema,
  systemPerformanceMetricsSchema,
} from './schemas'
import type {
  AiSummary,
  CombustionTelemetry,
  Investigation,
  InvestigationPage,
  InvestigationQuery,
  McpContextRequest,
  McpContextResponse,
  PredictionReport,
  SummarizeRequest,
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

// Título curto do erro para a tela (o detalhe técnico fica em error.message)
export function describeError(error: Error): string {
  if (error instanceof NetworkError) return 'Sem conexão com o backend'
  if (error instanceof ContractError) return 'Resposta fora do contrato'
  if (error instanceof ApiError) return `Backend respondeu com erro ${error.status}`
  return 'Erro inesperado'
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

// Relatório estático gerado por simulation/predicoes.py e embutido no build: funciona
// igual com mock ou backend. O parâmetro existe para os testes injetarem um arquivo quebrado.
export async function getPredictionReport(raw: unknown = predictionReportJson): Promise<PredictionReport> {
  const result = predictionReportSchema.safeParse(raw)
  if (!result.success) {
    throw new ContractError(`data/predicoes.json fora do contrato:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

// Catálogo do PSI: só os filtros informados vão para a query string
export function getInvestigations(query: InvestigationQuery = {}): Promise<InvestigationPage> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const search = params.size > 0 ? `?${params}` : ''
  return request(`/investigations${search}`, investigationPageSchema)
}

export function getInvestigation(accession: string): Promise<Investigation> {
  return request(`/investigations/${encodeURIComponent(accession)}`, investigationSchema)
}

// PLANEJADO no contrato: hoje só o mock MSW responde (o backend devolve 404)
export function summarizeInvestigation(accession: string): Promise<AiSummary> {
  const body: SummarizeRequest = { accession }
  return request('/ai/summarize', aiSummarySchema, { method: 'POST', body: JSON.stringify(body) })
}

export function postMcpContext(body: McpContextRequest): Promise<McpContextResponse> {
  return request('/mcp/context', mcpContextResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
