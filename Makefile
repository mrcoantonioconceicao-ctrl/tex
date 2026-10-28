SHELL := /bin/bash

# Mesmas variáveis que o docker compose lê do .env (modelo em .env.example)
-include .env

COMPOSE := docker compose
FRONTEND_DIR := frontend
INGESTION_DIR := ingestion
SIMULATION_DIR := simulation
# Linux/macOS: python3. Windows: python (o "python3" de lá costuma ser o atalho
# da Microsoft Store, que existe no PATH mas não roda nada)
PYTHON ?= $(shell python3 --version >/dev/null 2>&1 && echo python3 || echo python)

# Portas no host (mesmas variáveis do docker-compose.yml)
BACKEND_PORT := $(or $(TEX_BACKEND_PORT),8080)
FRONTEND_PORT := $(or $(TEX_FRONTEND_PORT),3000)

# Argumentos da ingestão: make ingest ARGS='--query "flame spread" --max 100'
ARGS ?= --max 50

.DEFAULT_GOAL := help

.PHONY: help up up-mock down restart rebuild status logs logs-backend logs-frontend logs-db \
	docker-build migrate db-reset db-shell smoke install frontend backend test test-frontend \
	test-ingestion test-simulation lint build verify ci ingest ingest-dry simulate simulate-check clean

help: ## Lista os comandos disponíveis
	@awk 'BEGIN {FS = ":.*##"; printf "\nComandos disponíveis:\n"} /^[a-zA-Z0-9_.-]+:.*##/ { printf "  %-16s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ---- Docker ----

up: ## Sobe backend, frontend e banco e aplica as migrações (painel em http://localhost:3000)
	$(COMPOSE) up -d --build --wait
	@$(MAKE) --no-print-directory migrate
	@echo "Painel: http://localhost:$(FRONTEND_PORT)  |  API: http://localhost:$(BACKEND_PORT)"

migrate: ## Aplica as migrações pendentes do banco (seguro repetir)
	$(COMPOSE) run --rm --build ingestion

up-mock: ## Sobe só o frontend com os mocks MSW (demo sem backend)
	TEX_USE_MOCKS=true $(COMPOSE) up -d --build --wait frontend
	@echo "Painel com mocks: http://localhost:$(FRONTEND_PORT)/?cenario=simulacao"

down: ## Para e remove os containers (mantém os dados do banco)
	$(COMPOSE) down

restart: ## Reinicia os serviços
	$(COMPOSE) restart

rebuild: ## Reconstrói as imagens e recria os containers
	$(COMPOSE) down
	$(COMPOSE) up -d --build --force-recreate --wait
	@$(MAKE) --no-print-directory migrate

status: ## Mostra o estado dos serviços
	$(COMPOSE) ps

logs: ## Acompanha os logs de todos os serviços
	$(COMPOSE) logs -f --tail=200

logs-backend: ## Acompanha os logs do backend
	$(COMPOSE) logs -f --tail=200 tex-backend

logs-frontend: ## Acompanha os logs do frontend (nginx)
	$(COMPOSE) logs -f --tail=200 frontend

logs-db: ## Acompanha os logs do banco
	$(COMPOSE) logs -f --tail=200 db

docker-build: ## Constrói as imagens sem subir os containers
	$(COMPOSE) build

db-reset: ## Recria o banco do zero (APAGA os dados), sobe a stack e aplica as migrações
	$(COMPOSE) down -v
	@$(MAKE) --no-print-directory up

db-shell: ## Abre o psql dentro do container do banco
	$(COMPOSE) exec db psql -U $${TEX_DB_USER:-tex} -d $${TEX_DB_NAME:-tex}

smoke: ## Checagem rápida da stack em execução
	@echo "--- backend: GET /api/v1/health"
	@curl -fsS http://localhost:$(BACKEND_PORT)/api/v1/health; echo
	@echo "--- backend: GET /api/v1/telemetry/latest"
	@curl -fsS http://localhost:$(BACKEND_PORT)/api/v1/telemetry/latest; echo
	@echo "--- frontend: GET /"
	@curl -fsS -o /dev/null -w "HTTP %{http_code}\n" http://localhost:$(FRONTEND_PORT)/
	@echo "--- frontend -> backend: GET /api/v1/telemetry/latest (via proxy do nginx)"
	@curl -fsS -o /dev/null -w "HTTP %{http_code}\n" http://localhost:$(FRONTEND_PORT)/api/v1/telemetry/latest

# ---- Desenvolvimento local (sem Docker) ----

install: ## Instala as dependências do frontend e da ingestão
	cd $(FRONTEND_DIR) && npm ci
	cd $(INGESTION_DIR) && npm ci

frontend: ## Roda o frontend em modo dev (Vite, http://localhost:5173)
	cd $(FRONTEND_DIR) && npm run dev

backend: ## Roda o backend localmente (cargo run)
	cargo run

test: test-frontend test-ingestion test-simulation ## Roda os testes do frontend, da ingestão e da simulação

test-frontend: ## Testes do frontend (Vitest)
	cd $(FRONTEND_DIR) && npm test

test-ingestion: ## Testes da ingestão (integração com o banco se TEX_TEST_DATABASE_URL existir)
	cd $(INGESTION_DIR) && npm test

test-simulation: ## Testes do modelo de predição (Python, só biblioteca padrão)
	$(PYTHON) -m unittest discover -s $(SIMULATION_DIR)

lint: ## Lint do frontend, tipos da ingestão e JSON de predições atualizado
	cd $(FRONTEND_DIR) && npm run lint
	cd $(INGESTION_DIR) && npm run typecheck
	@$(MAKE) --no-print-directory simulate-check

build: ## Build de produção do frontend
	cd $(FRONTEND_DIR) && npm run build

verify: lint test build ## Lint, testes e build

ci: verify docker-build ## Fluxo de CI local (verify + imagens Docker)

# ---- Ingestão ----

ingest: ## Ingestão NTRS no banco, no container (make ingest ARGS='--max 100')
	$(COMPOSE) run --rm --build ingestion node src/cli.ts $(ARGS)

ingest-dry: ## Ingestão NTRS sem gravar no banco (só mostra)
	$(COMPOSE) run --rm --build ingestion node src/cli.ts --dry-run $(ARGS)

# ---- Simulação preditiva ----

simulate: ## Regera o relatório de predições lido pelo painel (frontend/src/data/predicoes.json)
	$(PYTHON) $(SIMULATION_DIR)/predicoes.py

simulate-check: ## Falha se o relatório de predições estiver desatualizado
	$(PYTHON) $(SIMULATION_DIR)/predicoes.py --check

clean: ## Remove artefatos de build locais
	rm -rf $(FRONTEND_DIR)/dist
