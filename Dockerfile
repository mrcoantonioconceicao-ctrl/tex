# --- Etapa 1: Construção do Backend em Rust ---
FROM rust:1.75-slim AS rust-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

# --- Etapa 2: Construção do Frontend (React/Vite) ---
FROM node:20-alpine AS node-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Etapa 3: Imagem Final de Execução ---
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=rust-builder /app/target/release/tex_labs_space_fire /app/tex_labs_space_fire
COPY --from=node-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8080

CMD ["./tex_labs_space_fire"]
