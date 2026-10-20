import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { loadMigrations, migrate, sha256 } from '../src/migrations.ts'

const tempDirs: string[] = []

// Pasta temporária com arquivos .sql sintéticos
async function migrationsDir(files: Record<string, string>): Promise<URL> {
  const dir = await mkdtemp(join(tmpdir(), 'tex-migrations-'))
  tempDirs.push(dir)
  for (const [name, sql] of Object.entries(files)) await writeFile(join(dir, name), sql)
  return pathToFileURL(`${dir}/`)
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('loadMigrations', () => {
  it('carrega em ordem de versão, com o hash de cada arquivo', async () => {
    const dir = await migrationsDir({ '0002_b.sql': 'SELECT 2;', '0001_a.sql': 'SELECT 1;', 'LEIAME.txt': 'x' })

    const migrations = await loadMigrations(dir)

    expect(migrations.map((m) => m.version)).toEqual(['0001', '0002'])
    expect(migrations[0]).toMatchObject({ name: '0001_a.sql', sql: 'SELECT 1;', checksum: sha256('SELECT 1;') })
  })

  it('recusa nome fora do padrão NNNN_descricao.sql', async () => {
    const dir = await migrationsDir({ 'nova-tabela.sql': 'SELECT 1;' })

    await expect(loadMigrations(dir)).rejects.toThrow(/Nome de migração inválido/)
  })

  it('recusa duas migrações com a mesma versão', async () => {
    const dir = await migrationsDir({ '0001_a.sql': 'SELECT 1;', '0001_b.sql': 'SELECT 2;' })

    await expect(loadMigrations(dir)).rejects.toThrow(/repetida: 0001/)
  })

  it('encontra o schema inicial do projeto', async () => {
    const migrations = await loadMigrations()

    expect(migrations[0].name).toBe('0001_initial_schema.sql')
    expect(migrations[0].sql).toContain('CREATE TABLE IF NOT EXISTS documents')
  })
})

// Integração: só roda com um Postgres disponível (make up), ex.:
//   TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex npm test
const databaseUrl = process.env.TEX_TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('migrate (PostgreSQL)', () => {
  it('aplica uma vez só e registra o hash', async () => {
    const client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const migrations = await loadMigrations()
      await migrate(client, migrations)

      const second = await migrate(client, migrations)

      expect(second.applied).toEqual([])
      expect(second.skipped).toContain('0001_initial_schema.sql')
      const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', ['0001'])
      expect(rows[0].checksum).toBe(migrations[0].checksum)
    } finally {
      await client.end()
    }
  })

  it('recusa migração já aplicada que foi alterada', async () => {
    const client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const [initial] = await loadMigrations()
      await migrate(client, [initial])
      const tampered = { ...initial, sql: `${initial.sql}\n-- editado`, checksum: sha256('outro conteúdo') }

      await expect(migrate(client, [tampered])).rejects.toThrow(/já foi aplicada e o arquivo mudou/)
    } finally {
      await client.end()
    }
  })
})
