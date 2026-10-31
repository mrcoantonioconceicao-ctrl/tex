// Download das tabelas do PSI só com dado SINTÉTICO: fetch falso, CSV inventado e
// códigos PSI-99xxx, que não existem no PSI. Nada aqui acessa a rede.
import path from 'node:path'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { listPendingFiles, markDownloaded } from '../src/db.ts'
import {
  buildDownloadLinkUrl,
  downloadCsv,
  downloadPending,
  isDownloadAllowed,
  localPath,
  MAX_CSV_BYTES,
  parseSignedLink,
  sha256Hex,
  type PendingFile,
} from '../src/psi-download.ts'

const CSV = new TextEncoder().encode('teste,o2_pct\nT1,21.0\n')
const SIGNED = 'https://bucket.example.test/PSI-99901/tabela.csv?X-Amz-Signature=abc'
const noRetry = { retries: 0 }

function file(overrides: Partial<PendingFile> = {}): PendingFile {
  return { fileId: 1, accession: 'PSI-99901', version: 2, fileName: 'tabela.csv', fileBytes: CSV.byteLength, ...overrides }
}

// /download devolve o link; o link devolve o CSV
function fakePsi(linkBody: string = JSON.stringify({ url: SIGNED }), csv: Uint8Array = CSV) {
  const urls: string[] = []
  const impl = (async (input: string | URL | Request) => {
    const url = String(input)
    urls.push(url)
    if (url.includes('/download?')) return new Response(linkBody)
    if (url.startsWith('https://bucket.example.test/')) return new Response(csv)
    return new Response('não encontrado', { status: 404 })
  }) as typeof fetch
  return { impl, urls }
}

describe('regra de 14/11', () => {
  it('só libera o download a partir de 14/11 no horário de Brasília', () => {
    expect(isDownloadAllowed(new Date('2026-11-13T23:59:59-03:00'))).toBe(false)
    expect(isDownloadAllowed(new Date('2026-11-14T00:00:00-03:00'))).toBe(true)
  })
})

describe('link assinado', () => {
  it('monta a rota de download com arquivo, versão e redirect=false', () => {
    const url = new URL(buildDownloadLinkUrl('PSI-99901', 'tabela 1.csv', 2))

    expect(url.pathname).toBe('/geode-py/ws/studies/PSI-99901/download')
    expect(Object.fromEntries(url.searchParams)).toEqual({ file: 'tabela 1.csv', version: '2', redirect: 'false' })
  })

  it('aceita o link como texto, string JSON ou objeto (formato ainda não conferido)', () => {
    expect(parseSignedLink(SIGNED)).toBe(SIGNED)
    expect(parseSignedLink(JSON.stringify(SIGNED))).toBe(SIGNED)
    expect(parseSignedLink(JSON.stringify({ url: SIGNED }))).toBe(SIGNED)
    expect(parseSignedLink(JSON.stringify({ signed_url: SIGNED }))).toBe(SIGNED)
  })

  it('recusa resposta sem link e link fora de https', () => {
    expect(() => parseSignedLink('{"erro": "sem acesso"}')).toThrow(/sem link/)
    expect(() => parseSignedLink('http://bucket.example.test/x.csv')).toThrow(/https/)
  })
})

describe('downloadCsv', () => {
  it('devolve os bytes, o tamanho e o SHA-256', async () => {
    const { impl } = fakePsi()

    const csv = await downloadCsv(SIGNED, CSV.byteLength, impl, noRetry)

    expect(csv.size).toBe(CSV.byteLength)
    expect(csv.sha256).toBe(sha256Hex(CSV))
    expect(csv.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('recusa tamanho diferente do metadado do PSI', async () => {
    const { impl } = fakePsi()

    await expect(downloadCsv(SIGNED, CSV.byteLength + 1, impl, noRetry)).rejects.toThrow(/diferente do metadado/)
  })

  it('recusa arquivo acima do limite antes de ler o corpo', async () => {
    const huge = (async () =>
      new Response('x', { headers: { 'content-length': String(MAX_CSV_BYTES + 1) } })) as unknown as typeof fetch

    await expect(downloadCsv(SIGNED, null, huge, noRetry)).rejects.toThrow(/limite/)
  })
})

describe('localPath', () => {
  it('grava em <pasta>/<PSI>/<arquivo>', () => {
    expect(localPath('/dados', 'PSI-99901', 'tabela.csv')).toBe(path.join('/dados', 'PSI-99901', 'tabela.csv'))
  })

  it('recusa nome com caminho, oculto ou código fora do formato', () => {
    expect(() => localPath('/dados', 'PSI-99901', '../fora.csv')).toThrow(/recusado/)
    expect(() => localPath('/dados', 'PSI-99901', 'sub\\fora.csv')).toThrow(/recusado/)
    expect(() => localPath('/dados', 'PSI-99901', '.env')).toThrow(/recusado/)
    expect(() => localPath('/dados', '../PSI-1', 'tabela.csv')).toThrow(/formato/)
  })
})

describe('downloadPending', () => {
  it('baixa, grava e marca no banco; um arquivo com problema não derruba os outros', async () => {
    const { impl } = fakePsi()
    const saved: string[] = []
    const marked: Array<[number, string]> = []
    const files = [file(), file({ fileId: 2, version: null }), file({ fileId: 3, fileName: '../x.csv' })]

    const outcomes = await downloadPending(
      files,
      {
        fetchImpl: impl,
        retry: noRetry,
        dataDir: '/dados',
        save: async (filePath) => void saved.push(filePath),
        markDownloaded: async (fileId, sha256) => void marked.push([fileId, sha256]),
      },
      0,
    )

    expect(outcomes.map((o) => o.ok)).toEqual([true, false, false])
    expect(saved).toEqual([path.join('/dados', 'PSI-99901', 'tabela.csv')])
    expect(marked).toEqual([[1, sha256Hex(CSV)]])
    const reasons = outcomes.flatMap((o) => (o.ok ? [] : [o.reason]))
    expect(reasons[0]).toMatch(/psi_version/)
    expect(reasons[1]).toMatch(/recusado/)
  })

  it('não marca no banco se a gravação em disco falhar', async () => {
    const { impl } = fakePsi()
    const marked: number[] = []

    const [outcome] = await downloadPending(
      [file()],
      {
        fetchImpl: impl,
        retry: noRetry,
        dataDir: '/dados',
        save: async () => {
          throw new Error('disco cheio')
        },
        markDownloaded: async (fileId) => void marked.push(fileId),
      },
      0,
    )

    expect(outcome).toMatchObject({ ok: false, reason: 'disco cheio' })
    expect(marked).toEqual([])
  })
})

// Integração: só roda com um Postgres migrado (Ingestion CI ou make up), ex.:
//   TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex npm test
const databaseUrl = process.env.TEX_TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('listPendingFiles e markDownloaded (PostgreSQL)', () => {
  it('lista só tabelas pendentes e tira da lista depois de marcar', async () => {
    const client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ experiment_id: string }>(
        `INSERT INTO experiments (name, program, psi_accession, psi_version, raw, origin_category)
         VALUES ('Tex teste sintético PSI-99901', 'FLEX', 'PSI-99901', 2, '{"synthetic": true}', 'Synthetic')
         RETURNING experiment_id`,
      )
      await client.query(
        `INSERT INTO experiment_files (experiment_id, category, file_name, file_bytes)
         VALUES ($1, 'Experimental table', 'tabela.csv', 21), ($1, 'Video', 'bruto.mp4', 999)`,
        [rows[0].experiment_id],
      )

      const pending = await listPendingFiles(client, { accession: 'PSI-99901' })
      expect(pending).toEqual([
        { fileId: expect.any(Number), accession: 'PSI-99901', version: 2, fileName: 'tabela.csv', fileBytes: 21 },
      ])

      await markDownloaded(client, pending[0].fileId, sha256Hex(CSV))
      expect(await listPendingFiles(client, { accession: 'PSI-99901' })).toEqual([])
      expect(await listPendingFiles(client, { accession: 'PSI-99901', force: true })).toHaveLength(1)

      const marked = await client.query(
        'SELECT sha256, downloaded_at IS NOT NULL AS has_date FROM experiment_files WHERE file_id = $1',
        [pending[0].fileId],
      )
      expect(marked.rows[0]).toEqual({ sha256: sha256Hex(CSV), has_date: true })
      await expect(markDownloaded(client, -1, sha256Hex(CSV))).rejects.toThrow(/não existe/)
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })
})
