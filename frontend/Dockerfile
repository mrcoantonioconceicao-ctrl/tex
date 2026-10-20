# --- Etapa 1: build do Vite ---
# Node 22, o mesmo do CI (.github/workflows/frontend.yml)
FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# node_modules, dist e .env* do host ficam de fora pelo .dockerignore
COPY . .

# false: fala com o backend real via /api (proxy do nginx).
# true: liga os mocks MSW no navegador (plano B para demo sem backend).
ARG VITE_USE_MOCKS=false
ENV VITE_USE_MOCKS=${VITE_USE_MOCKS}
RUN npm run build

# --- Etapa 2: nginx servindo o build estático ---
# Variante unprivileged: roda sem root e escuta na 8080
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
