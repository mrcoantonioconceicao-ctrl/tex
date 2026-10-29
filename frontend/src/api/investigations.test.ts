// Contrato de /api/v1/investigations (docs/api-spec.yaml) contra os mocks sintéticos.
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { MOCK_INVESTIGATIONS } from '../mocks/investigations'
import { server } from '../mocks/node'
import { setMockScenario } from '../mocks/scenario'
import { ApiError, ContractError, getInvestigation, getInvestigations, NetworkError } from './client'
import { investigationPageSchema, investigationSchema } from './schemas'

describe('getInvestigations', () => {
  it('devolve a primeira página com o total, tudo marcado como Synthetic', async () => {
    const page = await getInvestigations()

    expect(page.total).toBe(MOCK_INVESTIGATIONS.length)
    expect(page).toMatchObject({ page: 1, page_size: 20 })
    expect(page.items.map((i) => i.accession)).toEqual(MOCK_INVESTIGATIONS.map((i) => i.accession))
    for (const item of page.items) expect(item.origin_category).toBe('Synthetic')
  })

  it('o item do catálogo não traz os campos do detalhe', async () => {
    const page = await getInvestigations()

    expect(page.items[0]).not.toHaveProperty('objective')
    expect(page.items[0]).not.toHaveProperty('files')
  })

  it('filtra por programa e tipo de projeto', async () => {
    const flex = await getInvestigations({ program: 'FLEX' })
    const ground = await getInvestigations({ project_type: 'Ground Investigation' })

    expect(flex.items.map((i) => i.accession)).toEqual(['PSI-9001'])
    expect(ground.items.map((i) => i.accession)).toEqual(['PSI-9005'])
  })

  it('busca texto sem diferenciar maiúsculas', async () => {
    const page = await getInvestigations({ q: 'saffire' })

    expect(page.items.map((i) => i.name)).toEqual(['SAFFIRE-II'])
  })

  it('pagina mantendo o total de todas as páginas', async () => {
    const page = await getInvestigations({ page: 2, page_size: 4 })

    expect(page).toMatchObject({ total: 6, page: 2, page_size: 4 })
    expect(page.items.map((i) => i.accession)).toEqual(['PSI-9005', 'PSI-9006'])
  })

  it('só manda para a query string os filtros informados', async () => {
    const urls: string[] = []
    server.use(
      http.get('*/api/v1/investigations', ({ request }) => {
        urls.push(new URL(request.url).search)
        return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 })
      }),
    )

    await getInvestigations()
    await getInvestigations({ program: 'BASS', q: '', page: 2 })

    expect(urls).toEqual(['', '?program=BASS&page=2'])
  })

  it('lança ApiError 400 para parâmetro fora do contrato', async () => {
    const error = await getInvestigations({ page_size: 101 }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
  })

  it('lança ContractError quando o programa não é do schema', async () => {
    server.use(
      http.get('*/api/v1/investigations', () =>
        HttpResponse.json({
          items: [{ ...MOCK_INVESTIGATIONS[0], program: 'FLEX-2' }],
          total: 1,
          page: 1,
          page_size: 20,
        }),
      ),
    )

    await expect(getInvestigations()).rejects.toThrow(ContractError)
  })

  it('offline lança NetworkError', async () => {
    setMockScenario('offline')

    await expect(getInvestigations()).rejects.toThrow(NetworkError)
  })
})

describe('getInvestigation', () => {
  it('devolve o detalhe com arquivos e textos da fonte', async () => {
    const detail = await getInvestigation('PSI-9003')

    expect(detail).toMatchObject({ accession: 'PSI-9003', program: 'ACME', file_count: 2, license: 'CC0-1.0' })
    expect(detail.files).toHaveLength(2)
    expect(detail.files[0]).toMatchObject({ sha256: null, downloaded_at: null })
  })

  it('aceita campos opcionais nulos (investigação sem tipo nem datas)', async () => {
    const detail = await getInvestigation('PSI-9006')

    expect(detail).toMatchObject({ project_type: null, start_date: null, sub_research_area: null })
  })

  it('lança ApiError 404 para código inexistente', async () => {
    const error = await getInvestigation('PSI-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })

  it('lança ApiError 400 para código fora do formato', async () => {
    const error = await getInvestigation('abc').catch((e: unknown) => e)

    expect((error as ApiError).status).toBe(400)
  })
})

describe('schemas das investigações', () => {
  it('todos os mocks seguem o contrato', () => {
    for (const item of MOCK_INVESTIGATIONS) expect(investigationSchema.safeParse(item).success).toBe(true)
  })

  it('recusa data fora do formato AAAA-MM-DD', () => {
    const broken = { ...MOCK_INVESTIGATIONS[0], start_date: '01-15-2020' }

    expect(investigationSchema.safeParse(broken).success).toBe(false)
  })

  it('recusa page_size acima de 100', () => {
    const page = { items: [], total: 0, page: 1, page_size: 101 }

    expect(investigationPageSchema.safeParse(page).success).toBe(false)
  })
})
