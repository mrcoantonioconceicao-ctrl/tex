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

## Com Docker

Na raiz do repositório (`make help` lista todos os comandos):

```bash
make up        # backend + frontend + banco; painel em http://localhost:3000
make up-mock   # só o frontend, com os mocks (plano B para demo sem backend)
make smoke     # checagem rápida da stack
make down
```

A imagem (`frontend/Dockerfile`) faz o build com Node 22 e serve o `dist` com nginx
sem root. O nginx (`frontend/nginx.conf`) encaminha `/api` para o serviço `tex-backend`:
tela e API ficam na mesma origem, sem precisar de CORS.

## Cenários de mock

Com mocks ligados, o seletor "Cenário do mock" no topo da tela troca o comportamento
da API falsa. Também dá para abrir direto pela URL, ex.: `http://localhost:5173/?cenario=critico`.

| Cenário | O que simula |
| --- | --- |
| `backend` (padrão) | Leitura inicial do backend (`SIM-TEX-001`); muda pelos botões de controle |
| `simulacao` | Mesma física do backend: aquece, aciona a supressão acima de 900 °C e esfria até 870 °C |
| `critico` | Supressão ativa (`CRITICAL_SUPPRESSION_ACTIVE`) |
| `offline` | Backend fora do ar (falha de rede) |
| `lento` | 4 s por resposta (dispara o aviso de dado desatualizado) |
| `fora-do-contrato` | Resposta sem `flame_spread_rate_mm_s` (dispara o erro de contrato) |

Todos os valores são **sintéticos** (`experiment_id` `SIM-TEX-001`, igual ao backend,
ou começando com `SINTETICO`). Nenhum é dado da NASA.

Os botões **Acionar supressão** e **Reiniciar simulação** (abaixo do nível de risco)
chamam `POST /api/v1/simulation/suppress` e `/reset`, tanto no mock quanto no backend real.

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
