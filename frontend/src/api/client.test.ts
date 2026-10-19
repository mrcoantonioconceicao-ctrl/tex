import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../mocks/node'
import { setMockScenario } from '../mocks/scenario'
import {
  ApiError,
  ContractError,
  getLatestTelemetry,
  getSystemMetrics,
  NetworkError,
  postMcpContext,
} from './client'

describe('getLatestTelemetry', () => {
  it('retorna a telemetria no formato do backend', async () => {
    const telemetry = await getLatestTelemetry()

    expect(telemetry).toEqual({
      experiment_id: 'NASA-ISS-CIR-042',
      chamber_temperature_c: 854.5,
      oxygen_concentration_pct: 21.2,
      flame_spread_rate_mm_s: 1.45,
      risk_level: 'MODERATE_WARNING',
    })
  })

  it('lança ApiError com o status HTTP quando a resposta não é ok', async () => {
    server.use(
      http.get('*/api/v1/telemetry/latest', () => new HttpResponse(null, { status: 503 })),
    )

    const error = await getLatestTelemetry().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(503)
    expect((error as ApiError).message).toBe('GET /telemetry/latest falhou (503)')
  })

  it('lança ContractError quando falta um campo', async () => {
    server.use(
      http.get('*/api/v1/telemetry/latest', () =>
        HttpResponse.json({
          experiment_id: 'X',
          chamber_temperature_c: 1,
          oxygen_concentration_pct: 1,
          risk_level: 'MODERATE_WARNING',
        }),
      ),
    )

    const error = await getLatestTelemetry().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ContractError)
    expect((error as ContractError).message).toContain('flame_spread_rate_mm_s')
  })

  it('lança ContractError quando um campo vem com tipo errado', async () => {
    server.use(
      http.get('*/api/v1/telemetry/latest', () =>
        HttpResponse.json({
          experiment_id: 'X',
          chamber_temperature_c: '854.5',
          oxygen_concentration_pct: 1,
          flame_spread_rate_mm_s: 1,
          risk_level: 'MODERATE_WARNING',
        }),
      ),
    )

    await expect(getLatestTelemetry()).rejects.toThrow(/chamber_temperature_c/)
  })

  it('aceita campos extras vindos do backend e os descarta', async () => {
    server.use(
      http.get('*/api/v1/telemetry/latest', () =>
        HttpResponse.json({
          experiment_id: 'X',
          chamber_temperature_c: 1,
          oxygen_concentration_pct: 1,
          flame_spread_rate_mm_s: 1,
          risk_level: 'MODERATE_WARNING',
          new_field: true,
        }),
      ),
    )

    const telemetry = await getLatestTelemetry()

    expect(telemetry).not.toHaveProperty('new_field')
  })
})

describe('postMcpContext', () => {
  it('envia a query como JSON e devolve o contexto', async () => {
    let received: unknown
    server.use(
      http.post('*/api/v1/mcp/context', async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({
          protocol: 'MCP-Enterprise-v1',
          status: 'ACTIVE_OPTIMIZED',
          compressed_context: 'ok',
          token_metrics: {
            original_estimated_tokens: 4,
            compressed_tokens: 4,
            compression_efficiency_pct: 0,
          },
        })
      }),
    )

    const response = await postMcpContext({ query: 'oxigênio' })

    expect(received).toEqual({ query: 'oxigênio' })
    expect(response.compressed_context).toBe('ok')
  })

  it('lança ApiError com o método POST na mensagem', async () => {
    server.use(
      http.post('*/api/v1/mcp/context', () => new HttpResponse(null, { status: 500 })),
    )

    await expect(postMcpContext({ query: 'x' })).rejects.toThrow('POST /mcp/context falhou (500)')
  })

  it('lança ContractError quando token_metrics vem incompleto', async () => {
    server.use(
      http.post('*/api/v1/mcp/context', () =>
        HttpResponse.json({
          protocol: 'MCP-Enterprise-v1',
          status: 'ACTIVE_OPTIMIZED',
          compressed_context: 'ok',
          token_metrics: { compressed_tokens: 4 },
        }),
      ),
    )

    await expect(postMcpContext({ query: 'x' })).rejects.toThrow(ContractError)
  })
})

describe('getSystemMetrics', () => {
  it('retorna as métricas no formato do backend', async () => {
    const metrics = await getSystemMetrics()

    expect(metrics.ast_parsing_latency_us).toBe(14)
    expect(metrics.graphrag_query_latency_us).toBe(125)
    expect(metrics.uptime_status).toBe('NOMINAL_ACTIVE')
  })

  it('lança ContractError quando a latência não é inteiro não negativo', async () => {
    server.use(
      http.get('*/api/v1/metrics', () =>
        HttpResponse.json({
          system_target: 'x',
          ast_parsing_latency_us: -1,
          graphrag_query_latency_us: 1.5,
          token_crusher_efficiency_pct: 0,
          memory_safety_guarantee: 'x',
          uptime_status: 'x',
        }),
      ),
    )

    await expect(getSystemMetrics()).rejects.toThrow(ContractError)
  })
})

describe('falha de rede', () => {
  it('lança NetworkError quando não há resposta', async () => {
    server.use(http.get('*/api/v1/telemetry/latest', () => HttpResponse.error()))

    const error = await getLatestTelemetry().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NetworkError)
    expect((error as NetworkError).message).toBe('GET /telemetry/latest sem conexão com o backend')
  })
})

describe('cenários do mock', () => {
  it('critico devolve supressão ativa com dado sintético', async () => {
    setMockScenario('critico')

    const telemetry = await getLatestTelemetry()

    expect(telemetry.risk_level).toBe('CRITICAL_SUPPRESSION_ACTIVE')
    expect(telemetry.experiment_id).toMatch(/^SINTETICO/)
  })

  it('offline derruba todos os endpoints com NetworkError', async () => {
    setMockScenario('offline')

    await expect(getLatestTelemetry()).rejects.toThrow(NetworkError)
    await expect(getSystemMetrics()).rejects.toThrow(NetworkError)
    await expect(postMcpContext({ query: 'x' })).rejects.toThrow(NetworkError)
  })

  it('fora-do-contrato é barrado pela validação', async () => {
    setMockScenario('fora-do-contrato')

    await expect(getLatestTelemetry()).rejects.toThrow(/flame_spread_rate_mm_s/)
  })

  it('simulacao oscila, entra em supressão crítica e depois recomeça', async () => {
    setMockScenario('simulacao')

    const readings = []
    for (let i = 0; i < 40; i++) readings.push(await getLatestTelemetry())
    const temperatures = readings.map((r) => r.chamber_temperature_c)

    expect(new Set(temperatures).size).toBeGreaterThan(10)
    const critical = readings.find((r) => r.risk_level === 'CRITICAL_SUPPRESSION_ACTIVE')
    expect(critical?.oxygen_concentration_pct).toBe(12)
    // passou de 960 °C e voltou ao valor inicial
    expect(temperatures.lastIndexOf(854.5)).toBeGreaterThan(0)
  })
})
