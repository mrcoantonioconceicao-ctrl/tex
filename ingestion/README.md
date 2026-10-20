# Ingestão de dados (NTRS → PostgreSQL)

Esqueleto do pipeline de dados do Tex Labs. Por enquanto coleta citações públicas do
[NASA Technical Reports Server](https://ntrs.nasa.gov) e grava no PostgreSQL local.
As buscas específicas do desafio entram a partir de 14/11/2026, com o enunciado oficial.

## Como rodar (Docker, recomendado)

Da raiz do repositório, sem precisar de Node na máquina:

```bash
make up                                   # sobe a stack e aplica as migrações
make ingest-dry ARGS='--max 10'           # só busca e mostra, sem gravar
make ingest ARGS='--query "microgravity combustion" --max 50'
make db-shell                             # psql dentro do container
```

Opções da coleta: `make ingest-dry ARGS='--help'`.

## Como rodar (Node local)

Requer Node.js 22.18 ou mais novo (roda TypeScript direto, sem build).

```bash
cd ingestion
npm install
npm run db:up        # só o Postgres (porta 5433)
npm run db:migrate
npm run ingest:ntrs -- --dry-run --max 10
```

`DATABASE_URL` sobrescreve o banco padrão (`postgres://tex:tex@127.0.0.1:5433/tex`).

Exemplos no psql:

```sql
SELECT id_ntrs, title, canonical_url FROM documents LIMIT 10;
SELECT d.title, a.name FROM document_authors da
  JOIN documents d USING (document_id) JOIN authors a USING (author_id) LIMIT 10;
SELECT * FROM ingestion_runs ORDER BY id DESC LIMIT 5;
SELECT * FROM schema_migrations;
```

## Migrações

O schema vive em `db/migrations/NNNN_descricao.sql`, aplicadas em ordem por `make migrate`
(o `make up` já chama). Cada migração roda **uma vez só**, numa transação, e fica
registrada em `schema_migrations` com o SHA-256 do arquivo.

- **Mudou o schema?** Crie a próxima migração (`0002_adiciona_x.sql`). Não edite uma já
  aplicada: o executor recusa arquivo alterado.
- O schema segue o mínimo obrigatório do `CLAUDE.md`: extensões são permitidas, remoções não.
- `make db-reset` apaga o banco e reaplica tudo do zero (só para desenvolvimento).

## Testes

```bash
npm test          # unitários, com uma resposta real do NTRS como fixture
npm run typecheck

# integração com o Postgres (precisa do make up antes)
TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex npm test
```

## Como funciona

| Arquivo | Papel |
| --- | --- |
| `src/ntrs.ts` | Busca paginada (`page.from` / `page.size`), validação com Zod e conversão para linhas |
| `src/db.ts` | Upsert por `id_ntrs` em transação, autores em tabela própria, registro de execuções |
| `src/migrations.ts` | Executor de migrações (ordem, transação, hash, trava contra execução simultânea) |
| `src/cli.ts` / `src/migrate-cli.ts` | Linhas de comando da coleta e das migrações |
| `db/migrations/` | Schema mínimo do `CLAUDE.md` + `raw` JSONB e `ingestion_runs`; Postgres com pgvector |

- **Nada é inventado:** cada linha vem da API do NTRS, e o registro original completo
  fica na coluna `raw` (jsonb).
- **Registro estranho não derruba a coleta:** cada resultado é validado à parte; os
  inválidos aparecem como "rejeitado" no terminal e o resto segue.
- **Reexecutar é seguro:** o upsert atualiza em vez de duplicar.
- **Educado com a API pública:** pausa de 500 ms entre páginas.
- **Resiste a falha passageira:** rede, 408, 429 e 5xx são repetidos até 3 vezes com espera
  crescente (1 s, 2 s, 4 s, no máximo 30 s), respeitando o `Retry-After` do servidor.
  Erros que não mudam tentando de novo (ex.: 404) falham na hora.

## Próximos passos (após 14/11)

- Termos de busca definidos a partir do enunciado do desafio
- Baixar e extrair o texto completo (`fulltext_url`) para o GraphRAG
- Fonte PSI (dados de experimentos FLEX/ACME/Saffire), após checagem manual do portal
- Banco na Azure (PostgreSQL Flexible Server) quando o ambiente for definido
