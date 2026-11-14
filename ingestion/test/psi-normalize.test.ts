// Normalização das tabelas do PSI só com dado SINTÉTICO: CSV inventado e códigos
// PSI-99xxx, que não existem no PSI. Nada aqui lê os CSVs reais nem acessa a rede.
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { replaceTableRuns, type DownloadedTable } from '../src/db.ts'
import {
  decodeCsv,
  normalizeTable,
  parseCell,
  parseCsv,
  parseDate,
  type TableMapping,
} from '../src/psi-normalize.ts'
import { PSI_TABLES, PSI_TABLES_SKIPPED } from '../src/psi-tables.ts'

describe('decodeCsv', () => {
  it('lê UTF-8 com BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a,b\n1,2\n')])
    expect(decodeCsv(bytes)).toBe('a,b\n1,2\n')
  })

  it('cai para Windows-1252 quando não é UTF-8 (0x96 = travessão)', () => {
    expect(decodeCsv(new Uint8Array([0x61, 0x2c, 0x96]))).toBe('a,\u2013')
  })
})

describe('parseCsv', () => {
  it('trata aspas, vírgula e quebra de linha dentro de aspas, aspas dobradas e CRLF', () => {
    const csv = 'id,nota\r\n1,"a, b"\r\n2,"linha 1\nlinha 2"\r\n3,"diz ""oi"""\r\n'
    expect(parseCsv(csv)).toEqual([
      ['id', 'nota'],
      ['1', 'a, b'],
      ['2', 'linha 1\nlinha 2'],
      ['3', 'diz "oi"'],
    ])
  })

  it('descarta linhas só com vírgulas', () => {
    expect(parseCsv('a,b\n1,2\n,,\n,\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseCell', () => {
  it('lê número limpo, com unidade e aproximado', () => {
    expect(parseCell('22.2')).toEqual({ value: 22.2, unit: null, approximate: false })
    expect(parseCell(' .33 cm')).toEqual({ value: 0.33, unit: 'cm', approximate: false })
    expect(parseCell('~ 21.5')).toEqual({ value: 21.5, unit: null, approximate: true })
    expect(parseCell('1.5e-3')).toEqual({ value: 0.0015, unit: null, approximate: false })
  })

  it('recusa faixa, lista, texto e marcador de ausente', () => {
    for (const cell of ['21.5 - 21.7', '21; 26.5', '22.1 to 22.0', '100% CH4', 'RAMPED', 'none', '\u2013', '>500', '']) {
      expect(parseCell(cell), cell).toBeNull()
    }
  })
})

describe('parseDate', () => {
  it('converte os três formatos das tabelas para ISO', () => {
    expect(parseDate('3/5/2009', 'mdy')).toBe('2009-03-05')
    expect(parseDate('10/24/09', 'mdy')).toBe('2009-10-24')
    expect(parseDate('9-Mar-17', 'd-mon-yy')).toBe('2017-03-09')
    expect(parseDate('17319', 'yyddd')).toBe('2017-11-15')
  })

  it('devolve null para data inválida', () => {
    expect(parseDate('2/30/2014', 'mdy')).toBeNull()
    expect(parseDate('21-Jul', 'd-mon-yy')).toBeNull()
    expect(parseDate('17400', 'yyddd')).toBeNull()
  })
})

const MAPPING: TableMapping = {
  testLabel: 'Test #',
  date: { column: 'Date', format: 'mdy' },
  sample: 'Material',
  outcome: 'End',
  measurements: [
    { column: 'O2 %', variable: 'o2_initial', unit: '%', range: [10, 100] },
    { column: 'Pressure; mmHg', variable: 'ambient_pressure', unit: 'mmHg' },
    { column: 'Thickness', variable: 'sample_thickness' },
    { column: 'Rate; mm', variable: 'burning_rate', unit: 'mm', review: 'unidade suspeita' },
  ],
  conditions: {
    o2: { column: 'O2 %', scale: 'percent' },
    pressure: { column: 'Pressure; mmHg', unit: 'mmHg' },
    flow: { column: 'Flow (cm/s)', unit: 'cm/s' },
    flowDirection: 'Direction',
  },
}

const CSV = [
  'Test #,Date,Material ,O2 %,Pressure;  mmHg,Thickness,Rate; mm,Flow (cm/s),Direction,End',
  'T1,2/19/2014,PMMA,22.2,760,0.27 mm,0.5,20,Concurrent ,Extinction',
  'T1,2/20/2014,PMMA,1.6,380,n/a,0.6,\u2013,Opposed,-',
  ',,Algodão,~ 21.5,,,,,,',
].join('\n')

describe('normalizeTable', () => {
  const { runs, skippedCells } = normalizeTable(CSV, MAPPING)

  it('um teste por linha, com rótulo único e raw com o cabeçalho original', () => {
    expect(runs.map((r) => r.testLabel)).toEqual(['T1', 'T1 (registro 2)', 'registro 3'])
    expect(runs[0].raw['Material ']).toBe('PMMA')
    expect(runs[0].raw['Pressure;  mmHg']).toBe('760')
    expect(runs[0]).toMatchObject({ runDate: '2014-02-19', sampleDescription: 'PMMA', outcome: 'Extinction' })
    // "-" é o marcador de vazio da fonte
    expect(runs[1].outcome).toBeNull()
  })

  it('medições com unidade do cabeçalho ou da célula; fora da faixa e coluna em revisão ficam a validar', () => {
    expect(runs[0].measurements).toEqual([
      { variable: 'o2_initial', value: 22.2, unit: '%', quality: 'EXTRACTED' },
      { variable: 'ambient_pressure', value: 760, unit: 'mmHg', quality: 'EXTRACTED' },
      { variable: 'sample_thickness', value: 0.27, unit: 'mm', quality: 'EXTRACTED' },
      { variable: 'burning_rate', value: 0.5, unit: 'mm', quality: 'PENDING_VALIDATION' },
    ])
    expect(runs[1].measurements[0]).toEqual({ variable: 'o2_initial', value: 1.6, unit: '%', quality: 'PENDING_VALIDATION' })
    expect(runs[2].measurements).toEqual([{ variable: 'o2_initial', value: 21.5, unit: '%', quality: 'PENDING_VALIDATION' }])
    // "n/a" da espessura fica só no raw
    expect(skippedCells).toBe(1)
  })

  it('condições nas unidades do schema; aproximado não vira condição', () => {
    const first = runs[0].condition
    expect(first).toMatchObject({ o2Percent: 22.2, diluent: null, flowDirection: 'concurrent' })
    expect(first?.pressureAtm).toBeCloseTo(1)
    expect(first?.flowMs).toBeCloseTo(0.2)
    expect(runs[1].condition).toMatchObject({ flowMs: null, flowDirection: 'opposed' })
    expect(runs[1].condition?.pressureAtm).toBeCloseTo(0.5)
    expect(runs[2].condition).toBeNull()
  })

  it('converte fração molar para % e escolhe o diluente de maior fração', () => {
    const mapping: TableMapping = {
      measurements: [],
      conditions: {
        o2: { column: 'XO2', scale: 'mole-fraction' },
        pressure: { column: 'p (bar)', unit: 'bar' },
        diluent: { N2: 'XN2', He: 'XHe' },
      },
    }
    const [run] = normalizeTable('XO2,XN2,XHe,p (bar)\n0.21,0,0.79,1.01325\n', mapping).runs
    expect(run.condition?.diluent).toBe('He')
    expect(run.condition?.pressureAtm).toBeCloseTo(1)
    expect(run.condition?.o2Percent).toBeCloseTo(21)
  })

  it('recusa arquivo sem uma coluna do mapa', () => {
    expect(() => normalizeTable('Test #,Date\nT1,2/19/2014\n', MAPPING)).toThrow(/colunas do mapa ausentes/)
  })
})

describe('mapa das tabelas reais', () => {
  it('não sobrepõe tabelas mapeadas e puladas, e usa nomes de variável em snake_case', () => {
    for (const key of Object.keys(PSI_TABLES_SKIPPED)) expect(PSI_TABLES[key]).toBeUndefined()
    for (const mapping of Object.values(PSI_TABLES)) {
      for (const m of mapping.measurements) expect(m.variable).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })
})

// Integração opcional (precisa do Postgres do make up):
//   TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex npm test
const databaseUrl = process.env.TEX_TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('replaceTableRuns (PostgreSQL)', () => {
  it('grava testes, condições e medições Measured, e reexecutar não duplica', async () => {
    const client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()
    let experimentId: number | null = null
    let fileId: number | null = null
    try {
      const experiment = await client.query<{ experiment_id: number }>(
        `INSERT INTO experiments (name, program, psi_accession, psi_version, raw, origin_category)
         VALUES ('Tex teste sintético PSI-99903', 'BASS', 'PSI-99903', 1, '{"synthetic": true}', 'Synthetic')
         RETURNING experiment_id::int`,
      )
      experimentId = experiment.rows[0].experiment_id
      const file = await client.query<{ file_id: number }>(
        `INSERT INTO experiment_files (experiment_id, category, file_name, sha256)
         VALUES ($1, 'Experimental table', 'sintetico.csv', repeat('a', 64)) RETURNING file_id::int`,
        [experimentId],
      )
      fileId = file.rows[0].file_id
      const table: DownloadedTable = {
        fileId,
        experimentId,
        accession: 'PSI-99903',
        fileName: 'sintetico.csv',
        sha256: 'a'.repeat(64),
      }
      const { runs } = normalizeTable(CSV, MAPPING)

      const first = await replaceTableRuns(client, table, runs)
      const second = await replaceTableRuns(client, table, runs)
      expect(second).toEqual(first)
      expect(first).toEqual({ runs: 3, conditions: 2, measurements: 8 })

      const { rows } = await client.query<{ origin_category: string; quality_status: string; n: number }>(
        `SELECT origin_category, quality_status, count(*)::int AS n FROM measurements
          WHERE source_file_id = $1 GROUP BY 1, 2 ORDER BY 2`,
        [fileId],
      )
      expect(rows).toEqual([
        { origin_category: 'Measured', quality_status: 'EXTRACTED', n: 4 },
        { origin_category: 'Measured', quality_status: 'PENDING_VALIDATION', n: 4 },
      ])
    } finally {
      if (fileId !== null) await client.query('DELETE FROM experimental_runs WHERE source_file_id = $1', [fileId])
      if (experimentId !== null) await client.query('DELETE FROM experiments WHERE experiment_id = $1', [experimentId])
      await client.end()
    }
  })
})
