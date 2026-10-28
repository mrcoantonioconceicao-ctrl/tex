# 🛰️ Tex Labs, NASA Space Apps Challenge 2026
Solução Preditiva e Auditoria de Segurança contra Incêndios em Microgravidade.

🚀 Sobre o Projeto
O Tex Labs é um ecossistema de software de alta performance desenvolvido para o NASA Space Apps Challenge 2026. O projeto foca em **simulações preditivas calibradas em dados publicados de missões** (Saffire IV a VI), auditoria normativa (NASA-STD-3001 e SMAC) e processamento descentralizado para ambientes espaciais, operando de forma autónoma e independente de telemetria em tempo real.

## O que é fato e o que é simulação

| Na tela | Origem | `origin_category` |
|---|---|---|
| Testes do Saffire IV a VI (pressão, O₂, ΔCO medido) | NTRS 20240002981, Tabelas 1 e 2 | `Published` |
| Limites SMAC de CO (100 ppm em 24 h, 425 ppm em 1 h) | NTRS 20240002981 p.5, citando JSC 20584 Rev. A | referência |
| Projeção de CO por material e fração de O₂ | modelo em `simulation/predicoes.py` (hipótese, não validado) | `Synthetic` |
| Telemetria da câmara (temperatura, O₂, chama) | simulação do backend (`src/simulation.rs`) | `Synthetic` |

Não há telemetria real da ISS. Detalhes das fontes em [`docs/conhecimento/`](docs/conhecimento/README.md).

## Como rodar

Com Docker (stack completa: backend, painel e PostgreSQL):

```bash
make up        # painel em http://localhost:3000
make up-mock   # só o painel, com mocks (sem backend)
make help      # todos os comandos
```

Sem Docker (só Node 22+ e Python 3.10+):

```bash
make install   # dependências do frontend e da ingestão
make frontend  # painel em http://localhost:5173 (use VITE_USE_MOCKS=true sem backend)
make verify    # lint, testes (frontend, ingestão, simulação) e build
make simulate  # regera frontend/src/data/predicoes.json depois de mudar o modelo
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | Backend Rust (Axum), API `/api/v1` descrita em `docs/api-spec.yaml` |
| `frontend/` | Painel React + TypeScript |
| `ingestion/` | Ingestão NTRS → PostgreSQL (TypeScript, Node 22) |
| `simulation/` | Modelo de predição de CO (Python, só biblioteca padrão) |
| `docs/` | Contrato da API, estudo de fontes e base de conhecimento |
