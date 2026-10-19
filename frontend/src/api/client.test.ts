import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../mocks/node'
import { ApiError, ContractError, getLatestTelemetry, postMcpContext } from './client'

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
