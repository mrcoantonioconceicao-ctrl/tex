// Migrações versionadas do banco. Cada arquivo db/migrations/NNNN_descricao.sql
// é aplicado UMA vez, em ordem, numa transação. A tabela schema_migrations guarda
// o que já foi aplicado e o SHA-256 de cada arquivo: editar uma migração já
// aplicada é recusado (o certo é criar a próxima).
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import type { ClientBase } from 'pg'

export const MIGRATIONS_DIR = new URL('../db/migrations/', import.meta.url)

const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/

// Trava do Postgres para duas execuções não aplicarem migrações ao mesmo tempo
const ADVISORY_LOCK_ID = 7_335_001

export interface Migration {
  version: string
  name: string
  sql: string
  checksum: string
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export async function loadMigrations(dir: URL = MIGRATIONS_DIR): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort()
  const migrations: Migration[] = []
  const seen = new Set<string>()

  for (const file of files) {
    const match = FILE_PATTERN.exec(file)
    if (!match) throw new Error(`Nome de migração inválido: ${file} (use 0001_descricao.sql)`)
    const version = match[1]
    if (seen.has(version)) throw new Error(`Versão de migração repetida: ${version}`)
    seen.add(version)

    const sql = await readFile(new URL(file, dir), 'utf8')
    migrations.push({ version, name: file, sql, checksum: sha256(sql) })
  }
  return migrations
}

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    checksum   TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`

export async function migrate(client: ClientBase, migrations: Migration[]): Promise<MigrationResult> {
  await client.query(CREATE_MIGRATIONS_TABLE)
  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID])
  try {
    const { rows } = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations',
    )
    const appliedChecksums = new Map(rows.map((row) => [row.version, row.checksum]))
    const result: MigrationResult = { applied: [], skipped: [] }

    for (const migration of migrations) {
      const appliedChecksum = appliedChecksums.get(migration.version)
      if (appliedChecksum !== undefined) {
        if (appliedChecksum !== migration.checksum) {
          throw new Error(
            `A migração ${migration.name} já foi aplicada e o arquivo mudou depois disso. ` +
              'Desfaça a alteração e crie uma nova migração.',
          )
        }
        result.skipped.push(migration.name)
        continue
      }

      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [
          migration.version,
          migration.name,
          migration.checksum,
        ])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`Falha ao aplicar ${migration.name}: ${reason}`)
      }
      result.applied.push(migration.name)
    }
    return result
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID])
  }
}
