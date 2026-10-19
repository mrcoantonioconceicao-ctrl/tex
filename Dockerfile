# --- Etapa 1: Construção do Backend em Rust ---
# 1.89+ é exigido pelo Cargo.lock (formato v4, uuid 1.28). Builder e imagem final
# usam o mesmo Debian (bookworm) para o binário encontrar a mesma glibc.
FROM rust:1.90-slim-bookworm AS rust-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
# Compila só as dependências primeiro: mudanças em src/ não recompilam tudo
RUN mkdir src && echo 'fn main() {}' > src/main.rs && cargo build --release --locked && rm -rf src
COPY src ./src
RUN touch src/main.rs && cargo build --release --locked

# --- Etapa 2: Construção do Frontend (React/Vite) ---
# Node 22, o mesmo do CI (.github/workflows/frontend.yml)
FROM node:22-alpine AS node-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
# node_modules, dist e .env* do host ficam de fora pelo .dockerignore
COPY frontend/ ./
# Build de produção sempre fala com o backend real, nunca com os mocks
ENV VITE_USE_MOCKS=false
RUN npm run build

# --- Etapa 3: Imagem Final de Execução ---
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home --shell /usr/sbin/nologin tex

COPY --from=rust-builder /app/target/release/tex_labs_space_fire /app/tex_labs_space_fire
# Pronto para quando o Axum passar a servir os arquivos estáticos do front
COPY --from=node-builder /app/frontend/dist /app/frontend/dist

USER tex
EXPOSE 8080

CMD ["./tex_labs_space_fire"]
