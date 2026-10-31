// Contrato de POST /api/v1/ai/summarize (docs/api-spec.yaml, planejado) contra o mock MSW.
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { MOCK_INVESTIGATIONS, summarizeInvestigation as mockSummarize } from '../mocks/investigations'
import { server } from '../mocks/node'
import { setMockScenario } from '../mocks/scenario'
import { ApiError, ContractError, NetworkError, summarizeInvestigation } from './client'
import { aiSummarySchema } from './schemas'

describe('summarizeInvestigation', () => {
  it('devolve o resumo marcado como Synthetic, sem modelo, dizendo de onde veio o texto', async () => {
    const summary = await summarizeInvestigation('PSI-9001')

    expect(summary).toMatchObject({
      accession: 'PSI-9001',
      source_fields: ['objective'],
      model: null,
      origin_category: 'Synthetic',
    })
    expect(summary.summary).toContain('Objetivo sintético de FLEX-2.')
  })

  it('manda o código no corpo do POST', async () => {
    let received: unknown = null
    server.use(
      http.post('*/api/v1/ai/summarize', async ({ request }) => {
        received = await request.json()
        return HttpResponse.json(mockSummarize('PSI-9002').body)
      }),
    )

    await summarizeInvestigation('PSI-9002')

    expect(received).toEqual({ accession: 'PSI-9002' })
  })

  it('lança ApiError 404 para código inexistente e 400 fora do formato', async () => {
    const missing = await summarizeInvestigation('PSI-1').catch((e: unknown) => e)
    const malformed = await summarizeInvestigation('abc').catch((e: unknown) => e)

    expect((missing as ApiError).status).toBe(404)
    expect((malformed as ApiError).status).toBe(400)
  })

  it('lança ContractError se o resumo vier como Published', async () => {
    server.use(
      http.post('*/api/v1/ai/summarize', () =>
        HttpResponse.json({ ...mockSummarize('PSI-9001').body, origin_category: 'Published' }),
      ),
    )

    await expect(summarizeInvestigation('PSI-9001')).rejects.toThrow(ContractError)
  })

  it('offline lança NetworkError', async () => {
    setMockScenario('offline')

    await expect(summarizeInvestigation('PSI-9001')).rejects.toThrow(NetworkError)
  })
})

describe('mock do resumo', () => {
  it('investigação sem texto da fonte responde 422 NO_SOURCE_TEXT em vez de inventar', () => {
    const empty = { ...MOCK_INVESTIGATIONS[0], accession: 'PSI-9999', objective: null }

    const result = mockSummarize('PSI-9999', [empty])

    expect(result).toEqual({
      status: 422,
      body: { code: 'NO_SOURCE_TEXT', message: 'PSI-9999 não tem objective, approach nem hypothesis' },
    })
  })

  it('corpo sem accession responde 400', () => {
    expect(mockSummarize(undefined).status).toBe(400)
    expect(mockSummarize(42).status).toBe(400)
  })

  it('usa todos os textos presentes, na ordem do contrato', () => {
    const full = { ...MOCK_INVESTIGATIONS[0], approach: 'Abordagem.', hypothesis: 'Hipótese.' }

    const result = mockSummarize(full.accession, [full])

    expect(result.status).toBe(200)
    if (result.status === 200) expect(result.body.source_fields).toEqual(['objective', 'approach', 'hypothesis'])
  })

  it('todos os resumos do catálogo seguem o contrato', () => {
    for (const item of MOCK_INVESTIGATIONS) {
      const result = mockSummarize(item.accession)
      expect(result.status).toBe(200)
      expect(aiSummarySchema.safeParse(result.body).success).toBe(true)
    }
  })

  it('o schema recusa source_fields vazio ou repetido', () => {
    const base = mockSummarize('PSI-9001').body

    expect(aiSummarySchema.safeParse({ ...base, source_fields: [] }).success).toBe(false)
    expect(aiSummarySchema.safeParse({ ...base, source_fields: ['objective', 'objective'] }).success).toBe(false)
  })
})
