// Respostas SINTÉTICAS no formato da API do PSI (conferido em 28/10/2026, ver
// docs/conhecimento/psi.md). Códigos PSI-9001/9002 não existem: nenhum dado real
// do desafio entra no repositório antes de 14/11.
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { finishRun, startRun, upsertInvestigations } from '../src/db.ts'
import {
  buildInvestigationUrl,
  buildPsiSearchUrl,
  fetchInvestigation,
  parsePsiDate,
  programFor,
  searchInvestigations,
  splitHardware,
} from '../src/psi.ts'

const microgravity = {
  accession: 'PSI-9001',
  version: 3,
  title: 'Investigação sintética de chama em gota',
  investigationAcronym: 'FLEX-2',
  projectType: 'Microgravity Investigation',
  subResearchArea: 'Spacecraft Fire Safety',
  objective: 'Objetivo sintético.',
  approach: 'Abordagem sintética.',
  hypothesis: '',
  experimentHardware: 'Combustion Integrated Rack (CIR), Multi-user Droplet Combustion Apparatus (MDCA)',
  doi: '10.0000/sintetico',
  licenseIdentifier: 'CC0-1.0',
  investigationStartDate: '01-15-2020',
  investigationEndDate: '02-31-2020',
  totalFileSize: 123456,
  experimentalTable: [
    { _id: { $oid: 'x' }, file_name: 'PSI-9001_Experimental table_FLEX-2.csv', file_size: 1029, s3_path: 'psi-data/PSI-9001/x.csv' },
  ],
  // campo que não validamos: precisa chegar intacto no raw
  campoExtra: { qualquer: 'coisa' },
}

const ground = {
  accession: 'PSI-9002',
  title: 'Investigação de solo sintética',
  investigationAcronym: '',
  projectType: 'Ground Investigation',
  experimentHardware: '',
  investigationStartDate: '',
  investigationEndDate: '',
  totalFileSize: 0,
}

const searchResponse = {
  took: 1,
  hits: { total: 2, hits: [{ _source: { Accession: 'PSI-9001' } }, { _source: { Accession: 'PSI-9002' } }] },
}

// Responde por URL: busca ou investigação
function fakeFetch(routes: Record<string, { body: unknown; status?: number }>) {
  const urls: string[] = []
  const impl = (async (input: string | URL | Request) => {
    const url = String(input)
    urls.push(url)
    const route = Object.entries(routes).find(([fragment]) => url.includes(fragment))?.[1]
    if (!route) return new Response('{}', { status: 404 })
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 })
  }) as typeof fetch
  return { impl, urls }
}

describe('URLs', () => {
  it('monta a busca com from/size e o tipo investigation', () => {
    const url = new URL(buildPsiSearchUrl({ term: 'combustion', from: 25, size: 25 }))

    expect(url.origin + url.pathname).toBe('https://psi.nasa.gov/geode-py/ws/repo/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      term: 'combustion',
      source: 'psi',
      type: 'investigation',
      from: '25',
      size: '25',
    })
  })

  it('monta a URL de uma investigação', () => {
    expect(buildInvestigationUrl('PSI-25')).toBe('https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-25')
  })
})

describe('parsePsiDate', () => {
  it('converte MM-DD-AAAA para AAAA-MM-DD', () => {
    expect(parsePsiDate('01-15-2020')).toBe('2020-01-15')
    expect(parsePsiDate('12-31-2022')).toBe('2022-12-31')
  })

  it('devolve null para vazio, formato errado ou data impossível', () => {
    expect(parsePsiDate(null)).toBeNull()
    expect(parsePsiDate('')).toBeNull()
    expect(parsePsiDate('2020-01-15')).toBeNull()
    expect(parsePsiDate('02-31-2020')).toBeNull()
  })
})

describe('programFor', () => {
  it('agrupa as investigações pelo programa do schema', () => {
    expect(programFor('FLEX-2')).toBe('FLEX')
    expect(programFor('ACME CFI-G')).toBe('ACME')
    expect(programFor('CFI')).toBe('CFI')
    expect(programFor('SAFFIRE-III')).toBe('Saffire')
    expect(programFor('BASS-II')).toBe('BASS')
    expect(programFor('SAME-R')).toBe('SAME')
    expect(programFor('DAFT / DAFT-2')).toBe('DAFT')
    expect(programFor('STDCE-1')).toBe('Other')
    expect(programFor(null)).toBe('Other')
  })
})

describe('splitHardware', () => {
  it('separa por vírgula ou ponto e vírgula', () => {
    expect(splitHardware('Combustion Integrated Rack (CIR), ACME')).toEqual(['Combustion Integrated Rack (CIR)', 'ACME'])
    expect(splitHardware('Hardware A; Refer to final report')).toEqual(['Hardware A', 'Refer to final report'])
    expect(splitHardware(null)).toEqual([])
  })
})

describe('searchInvestigations', () => {
  it('lê o total e os códigos da busca', async () => {
    const { impl } = fakeFetch({ '/repo/search': { body: searchResponse } })

    const page = await searchInvestigations({ term: 'combustion', from: 0, size: 50 }, impl)

    expect(page).toEqual({ total: 2, accessions: ['PSI-9001', 'PSI-9002'] })
  })

  it('falha com mensagem clara quando a busca muda de formato', async () => {
    const { impl } = fakeFetch({ '/repo/search': { body: { results: [] } } })

    await expect(searchInvestigations({ term: 'x', from: 0, size: 1 }, impl)).rejects.toThrow(/fora do formato/)
  })

  it('falha com o status HTTP do PSI', async () => {
    const { impl } = fakeFetch({ '/repo/search': { body: {}, status: 500 } })

    await expect(searchInvestigations({ term: 'x', from: 0, size: 1 }, impl, { retries: 0 })).rejects.toThrow(
      /PSI respondeu 500/,
    )
  })
})

describe('fetchInvestigation', () => {
  it('converte a investigação em linha para o banco', async () => {
    const { impl } = fakeFetch({ 'PSI-9001': { body: microgravity } })

    const result = await fetchInvestigation('PSI-9001', impl)

    if (!result.ok) throw new Error(result.reason)
    expect(result.row).toMatchObject({
      accession: 'PSI-9001',
      version: 3,
      name: 'FLEX-2',
      program: 'FLEX',
      projectType: 'Microgravity Investigation',
      hypothesis: null,
      hardware: ['Combustion Integrated Rack (CIR)', 'Multi-user Droplet Combustion Apparatus (MDCA)'],
      license: 'CC0-1.0',
      startDate: '2020-01-15',
      endDate: null,
      totalFileBytes: 123456,
      files: [
        {
          category: 'Experimental table',
          fileName: 'PSI-9001_Experimental table_FLEX-2.csv',
          fileBytes: 1029,
          remotePath: 'psi-data/PSI-9001/x.csv',
        },
      ],
    })
    // raw guarda o registro original completo, inclusive campos que não validamos
    expect(result.row.raw).toEqual(microgravity)
  })

  it('investigação sem sigla usa o código como nome e cai em Other', async () => {
    const { impl } = fakeFetch({ 'PSI-9002': { body: ground } })

    const result = await fetchInvestigation('PSI-9002', impl)

    if (!result.ok) throw new Error(result.reason)
    expect(result.row).toMatchObject({ name: 'PSI-9002', program: 'Other', hardware: [], startDate: null, files: [] })
  })

  it('rejeita investigação fora do formato sem lançar erro', async () => {
    const { impl } = fakeFetch({ 'PSI-9003': { body: { accession: 'abc', title: '' } } })

    const result = await fetchInvestigation('PSI-9003', impl)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('accession')
  })
})

// Integração: só roda com um Postgres disponível (make up), ex.:
//   TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex npm test
const databaseUrl = process.env.TEX_TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('upsertInvestigations (PostgreSQL)', () => {
  it('grava investigação e arquivos, e reexecutar não duplica', async () => {
    const { impl } = fakeFetch({ 'PSI-9001': { body: microgravity }, 'PSI-9002': { body: ground } })
    const rows = []
    for (const accession of ['PSI-9001', 'PSI-9002']) {
      const result = await fetchInvestigation(accession, impl)
      if (result.ok) rows.push(result.row)
    }
    const client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const runId = await startRun(client, 'psi-test', 'fixture')
      await upsertInvestigations(client, rows)
      await upsertInvestigations(client, rows)
      await finishRun(client, runId, { fetched: 2, upserted: 2, status: 'ok' })

      const accessions = ['PSI-9001', 'PSI-9002']
      const experiments = await client.query(
        `SELECT count(*)::int AS n, bool_and(raw IS NOT NULL) AS has_raw
           FROM experiments WHERE psi_accession = ANY($1)`,
        [accessions],
      )
      const files = await client.query(
        `SELECT count(*)::int AS n FROM experiment_files f
           JOIN experiments e USING (experiment_id) WHERE e.psi_accession = ANY($1)`,
        [accessions],
      )
      const flex = await client.query(
        'SELECT program, start_date::text, origin_category FROM experiments WHERE psi_accession = $1',
        ['PSI-9001'],
      )
      expect(experiments.rows[0]).toEqual({ n: 2, has_raw: true })
      expect(files.rows[0].n).toBe(1)
      // Migração 0003: o que vem da ingestão do PSI é Published
      expect(flex.rows[0]).toEqual({ program: 'FLEX', start_date: '2020-01-15', origin_category: 'Published' })
    } finally {
      await client.query('DELETE FROM experiments WHERE psi_accession IN ($1, $2)', ['PSI-9001', 'PSI-9002'])
      await client.end()
    }
  })
})
