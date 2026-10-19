# Tex Labs: painel (front-end)

SPA com Vite + React + TypeScript que mostra a telemetria de combustão, o nível de
risco, as métricas do sistema e a consulta MCP do backend Axum.

## Como rodar

```bash
cd frontend
npm install
cp .env.example .env.local   # ajuste VITE_USE_MOCKS conforme abaixo
npm run dev
```

- `VITE_USE_MOCKS=true`: usa os mocks MSW, sem precisar do backend.
- `VITE_USE_MOCKS=false`: chama o Axum em `127.0.0.1:8080` pelo proxy do Vite
  (rode `cargo run` na raiz do repositório antes).

## Cenários de mock

Com mocks ligados, o seletor "Cenário do mock" no topo da tela troca o comportamento
da API falsa. Também dá para abrir direto pela URL, ex.: `http://localhost:5173/?cenario=critico`.

| Cenário | O que simula |
| --- | --- |
| `backend` (padrão) | Os mesmos valores fixos do `src/main.rs` |
| `simulacao` | Temperatura oscilando como o laço do backend, entrando e saindo do crítico |
| `critico` | Supressão ativa (`CRITICAL_SUPPRESSION_ACTIVE`) |
| `offline` | Backend fora do ar (falha de rede) |
| `lento` | 4 s por resposta (dispara o aviso de dado desatualizado) |
| `fora-do-contrato` | Resposta sem `flame_spread_rate_mm_s` (dispara o erro de contrato) |

Todos os valores dos cenários são **sintéticos** (`experiment_id` começando com
`SINTETICO`), exceto `backend`, que copia o mock do próprio Axum. Nenhum é dado da NASA.

## Estrutura

| Pasta | Papel |
| --- | --- |
| `src/api/` | Única camada que fala com o backend: tipos, schemas Zod, client e hooks (TanStack Query) |
| `src/dashboard/` | Regras do painel (`model.ts`), hooks de tela, componentes e gráfico SVG |
| `src/mocks/` | Handlers MSW e cenários |

Comportamentos importantes:

- Resposta fora do contrato vira `ContractError` com o campo culpado; sem rede vira `NetworkError`.
- Se o backend cair, a última leitura continua na tela, marcada como desatualizada.
- Sem leitura nova por 3 ciclos de polling, aparece o aviso "Dados desatualizados".
- O histórico do gráfico (últimos 5 min) é montado no navegador, porque o backend só
  devolve a leitura mais recente.
- Risco e conexão nunca dependem só de cor: sempre há texto e ícone; o risco crítico é
  anunciado para leitores de tela.

## Scripts

```bash
npm test        # Vitest + Testing Library + MSW
npm run lint
npm run build
```

O CI (`.github/workflows/frontend.yml`) roda lint, testes e build em todo PR que mexe em `frontend/`.
