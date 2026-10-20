# Ferramentas da ingestão (migrações e coleta NTRS) sem depender de Node na máquina.
# Node 22.18+ roda TypeScript direto (type stripping): sem etapa de build.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY db ./db

USER node

# Padrão: aplicar migrações. A coleta usa outro comando (make ingest).
CMD ["node", "src/migrate-cli.ts"]
