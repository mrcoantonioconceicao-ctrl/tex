// Fixture: resposta REAL de GET https://ntrs.nasa.gov/api/citations/search
// ?q=microgravity combustion&page.size=3 em 19/10/2026 (sem o bloco aggregations).
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { finishRun, startRun, upsertCitations } from '../src/db.ts'
import { buildSearchUrl, fetchSearchPage, iterateSearch, parseNtrsDate } from '../src/ntrs.ts'

interface Fixture {
  stats: { total: number }
  results: Record<string, unknown>[]
}

const fixture: Fixture = JSON.parse(
  readFileSync(new URL('./fixtures/ntrs-search-microgravity-combustion.json', import.meta.url), 'utf8'),
)

function fakeFetch(body: unknown, status = 200) {
  const urls: string[] = []
  const impl = (async (input: string | URL | Request) => {
    urls.push(String(input))
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { impl, urls }
}

describe('buildSearchUrl', () => {
  it('monta a busca com paginação page.from/page.size', () => {
    const url = new URL(buildSearchUrl({ query: 'flame spread', from: 25, size: 25 }))

    expect(url.origin + url.pathname).toBe('https://ntrs.nasa.gov/api/citations/search')
    expect(url.searchParams.get('q')).toBe('flame spread')
    expect(url.searchParams.get('page.from')).toBe('25')
    expect(url.searchParams.get('page.size')).toBe('25')
  })
})

describe('parseNtrsDate', () => {
  it('aceita as 7 casas de fração do NTRS', () => {
    expect(parseNtrsDate('2015-12-15T13:08:57.3370000+00:00')?.toISOString()).toBe('2015-12-15T13:08:57.337Z')
    expect(parseNtrsDate('2019-07-12T00:00:00.0000000+00:00')?.toISOString()).toBe('2019-07-12T00:00:00.000Z')
  })

  it('devolve null para vazio ou inválido', () => {
    expect(parseNtrsDate(null)).toBeNull()
    expect(parseNtrsDate('')).toBeNull()
    expect(parseNtrsDate('não é data')).toBeNull()
  })
})

describe('fetchSearchPage', () => {
  it('converte a resposta real em linhas para o banco', async () => {
    const { impl } = fakeFetch(fixture)

    const page = await fetchSearchPage({ query: 'microgravity combustion', from: 0, size: 3 }, impl)

    expect(page.total).toBe(1076)
    expect(page.received).toBe(3)
    expect(page.rejected).toEqual([])
    const [first] = page.rows
    expect(first).toMatchObject({
      id: 20150023100,
      title: 'NASA Microgravity Combustion Program',
      stiType: 'PRESENTATION',
      centerCode: 'GRC',
      keywords: ['combustion', 'microgravity'],
      subjectCategories: ['Propellants And Fuels'],
      pdfUrl: 'https://ntrs.nasa.gov/api/citations/20150023100/downloads/20150023100.pdf',
      fulltextUrl: 'https://ntrs.nasa.gov/api/citations/20150023100/downloads/20150023100.txt',
    })
    expect(first.distributionDate?.toISOString()).toBe('2019-07-12T00:00:00.000Z')
    expect(first.authors).toEqual([
      { sequence: 0, name: 'Urban, David L.', organization: 'NASA Glenn Research Center', location: 'Cleveland, OH United States' },
    ])
    // raw guarda o registro original completo, inclusive campos que não validamos
    expect(first.raw).toEqual(fixture.results[0])
  })

  it('aceita registro real sem keywords', async () => {
    const { impl } = fakeFetch(fixture)

    const page = await fetchSearchPage({ query: 'x', from: 0, size: 3 }, impl)

    expect(page.rows[2].id).toBe(19990053965)
    expect(page.rows[2].keywords).toEqual([])
  })

  it('aceita id numérico vindo como string (visto em dado real)', async () => {
    const withStringId = { ...fixture, results: [{ ...fixture.results[0], id: '77766245676546' }] }
    const { impl } = fakeFetch(withStringId)

    const page = await fetchSearchPage({ query: 'x', from: 0, size: 1 }, impl)

    expect(page.rejected).toEqual([])
    expect(page.rows[0].id).toBe(77766245676546)
  })

  it('rejeita id que não é inteiro positivo', async () => {
    const badIds = { ...fixture, results: [{ ...fixture.results[0], id: 'abc' }, { ...fixture.results[0], id: -5 }] }
    const { impl } = fakeFetch(badIds)

    const page = await fetchSearchPage({ query: 'x', from: 0, size: 2 }, impl)

    expect(page.rows).toEqual([])
    expect(page.rejected).toHaveLength(2)
  })

  it('rejeita só o registro inválido e mantém os outros', async () => {
    const broken = { ...fixture, results: [...fixture.results, { id: 1, title: '' }] }
    const { impl } = fakeFetch(broken)

    const page = await fetchSearchPage({ query: 'x', from: 0, size: 4 }, impl)

    expect(page.rows).toHaveLength(3)
    expect(page.rejected).toHaveLength(1)
    expect(page.rejected[0]).toMatchObject({ index: 3, id: 1 })
    expect(page.rejected[0].reason).toContain('title')
  })

  it('falha com mensagem clara em erro HTTP', async () => {
    const { impl } = fakeFetch({}, 503)

    await expect(fetchSearchPage({ query: 'x', from: 0, size: 3 }, impl)).rejects.toThrow(/NTRS respondeu 503/)
  })

  it('falha quando o envelope muda de formato', async () => {
    const { impl } = fakeFetch({ hits: [] })

    await expect(fetchSearchPage({ query: 'x', from: 0, size: 3 }, impl)).rejects.toThrow(/fora do formato/)
  })
})

describe('iterateSearch', () => {
  it('pagina com page.from e para no máximo pedido', async () => {
    const { impl, urls } = fakeFetch(fixture)

    const pages = []
    for await (const page of iterateSearch({ query: 'x', max: 5, pageSize: 3, delayMs: 0, fetchImpl: impl })) {
      pages.push(page)
    }

    expect(urls.map((u) => new URL(u).searchParams.get('page.from'))).toEqual(['0', '3'])
    expect(urls.map((u) => new URL(u).searchParams.get('page.size'))).toEqual(['3', '2'])
    expect(pages).toHaveLength(2)
  })

  it('para quando o NTRS não tem mais resultados', async () => {
    const { impl, urls } = fakeFetch({ stats: { total: 3 }, results: fixture.results })

    for await (const page of iterateSearch({ query: 'x', max: 100, pageSize: 3, delayMs: 0, fetchImpl: impl })) {
      expect(page.rows).toHaveLength(3)
    }

    expect(urls).toHaveLength(1)
  })
})

// Integração: só roda com um Postgres disponível, ex.:
//   npm run db:up
//   TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex npm test
const databaseUrl = process.env.TEX_TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('upsertCitations (PostgreSQL)', () => {
  it('grava citações e autores, e reexecutar não duplica', async () => {
    const { impl } = fakeFetch(fixture)
    const page = await fetchSearchPage({ query: 'x', from: 0, size: 3 }, impl)
    const client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const runId = await startRun(client, 'ntrs-test', 'fixture')
      await upsertCitations(client, page.rows)
      await upsertCitations(client, page.rows)
      await finishRun(client, runId, { fetched: 3, upserted: 3, status: 'ok' })

      const ids = page.rows.map((r) => r.id)
      const citations = await client.query('SELECT count(*)::int AS n FROM ntrs_citations WHERE id = ANY($1)', [ids])
      const authors = await client.query('SELECT count(*)::int AS n FROM ntrs_authors WHERE citation_id = ANY($1)', [ids])
      const run = await client.query('SELECT status FROM ingestion_runs WHERE id = $1', [runId])
      expect(citations.rows[0].n).toBe(3)
      expect(authors.rows[0].n).toBe(3)
      expect(run.rows[0].status).toBe('ok')
    } finally {
      await client.end()
    }
  })
})
