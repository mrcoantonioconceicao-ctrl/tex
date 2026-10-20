// Aplica as migrações pendentes: `make migrate` (no container) ou `npm run db:migrate`.
// DATABASE_URL sobrescreve o banco padrão (Postgres do docker-compose.yml).
import pg from 'pg'
import { DEFAULT_DATABASE_URL } from './db.ts'
import { loadMigrations, migrate } from './migrations.ts'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL })

try {
  await client.connect()
  const { applied, skipped } = await migrate(client, await loadMigrations())
  for (const name of applied) console.log(`  ✔ aplicada: ${name}`)
  console.log(`Migrações: ${applied.length} aplicada(s), ${skipped.length} já estava(m) no banco`)
} catch (error) {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await client.end()
}
