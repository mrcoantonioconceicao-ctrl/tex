# Ingestão de dados (NTRS → PostgreSQL)

Esqueleto do pipeline de dados do Tex Labs. Por enquanto coleta citações públicas do
[NASA Technical Reports Server](https://ntrs.nasa.gov) e grava no PostgreSQL local.
As buscas específicas do desafio entram a partir de 14/11/2026, com o enunciado oficial.

## Requisitos

- Node.js 22.18 ou mais novo (roda TypeScript direto, sem build)
- Docker (só para o Postgres local)

## Como rodar

```bash
cd ingestion
npm install

# 1. Só buscar e mostrar, sem banco
npm run ingest:ntrs -- --dry-run --max 10

# 2. Subir o Postgres (porta 5433) e gravar
npm run db:up
npm run ingest:ntrs -- --query "microgravity combustion" --max 50
```

Opções: `npm run ingest:ntrs -- --help`.
`DATABASE_URL` sobrescreve o banco padrão (`postgres://tex:tex@127.0.0.1:5433/tex`).

O Postgres é o serviço `db` do `docker-compose.yml` da raiz. Da raiz do repositório:

```bash
make db-shell     # psql dentro do container
make db-reset     # recria o banco do zero (APAGA os dados)
```

Exemplos no psql:

```sql
SELECT id, title, center_code FROM ntrs_citations LIMIT 10;
SELECT * FROM ingestion_runs ORDER BY id DESC LIMIT 5;
```

## Testes

```bash
npm test          # unitários, com uma resposta real do NTRS como fixture
npm run typecheck

# integração com o Postgres (precisa do db:up antes)
TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex npm test
```

## Como funciona

| Arquivo | Papel |
| --- | --- |
| `src/ntrs.ts` | Busca paginada (`page.from` / `page.size`), validação com Zod e conversão para linhas |
| `src/db.ts` | Upsert por `id` em transação, autores regravados, registro de execuções |
| `src/cli.ts` | Linha de comando |
| `db/schema.sql` | Tabelas `ntrs_citations`, `ntrs_authors` e `ingestion_runs` |

- **Nada é inventado:** cada linha vem da API do NTRS, e o registro original completo
  fica na coluna `raw` (jsonb).
- **Registro estranho não derruba a coleta:** cada resultado é validado à parte; os
  inválidos aparecem como "rejeitado" no terminal e o resto segue.
- **Reexecutar é seguro:** o upsert atualiza em vez de duplicar.
- **Educado com a API pública:** pausa de 500 ms entre páginas.

## Próximos passos (após 14/11)

- Termos de busca definidos a partir do enunciado do desafio
- Baixar e extrair o texto completo (`fulltext_url`) para o GraphRAG
- Fonte PSI (dados de experimentos FLEX/ACME/Saffire), após checagem manual do portal
- Banco na Azure (PostgreSQL Flexible Server) quando o ambiente for definido
