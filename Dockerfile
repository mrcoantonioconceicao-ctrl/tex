# --- Etapa 1: Construção do Backend em Rust ---
# 1.89+ é exigido pelo Cargo.lock (formato v4, uuid 1.28). Builder e imagem final
# usam o mesmo Debian (bookworm) para o binário encontrar a mesma glibc.
FROM rust:1.99-slim-bookworm AS rust-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
# Compila só as dependências primeiro: mudanças em src/ não recompilam tudo
RUN mkdir src && echo 'fn main() {}' > src/main.rs && cargo build --release --locked && rm -rf src
COPY src ./src
RUN touch src/main.rs && cargo build --release --locked

# O frontend tem imagem própria (frontend/Dockerfile, nginx), que encaminha /api para cá.

# --- Etapa 2: Imagem Final de Execução ---
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home --shell /usr/sbin/nologin tex

COPY --from=rust-builder /app/target/release/tex_labs_space_fire /app/tex_labs_space_fire
# Lido na inicialização (projeto e domínios DDD aparecem no log)
COPY config ./config

USER tex
EXPOSE 8080

CMD ["./tex_labs_space_fire"]
