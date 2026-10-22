# Pontes com o Tex: do PDF da NASA para o schema e para o pitch

Este arquivo liga o que foi estudado ao que o Tex já tem:
- schema em `ingestion/db/migrations/0001_initial_schema.sql`;
- regras de linhagem no `CLAUDE.md`.

**Nada aqui foi gravado no banco.** São propostas para depois de 14/11.

## 1. Onde cada coisa entra

| Conceito nos documentos | Tabela do Tex | Observação |
|---|---|---|
| Documento NTRS (os 14 desta pasta) | `documents` (+ `authors`, `document_authors`) | `id_ntrs` = ID da tabela do README |
| Programa (FLEX, ACME, Saffire, BASS) | `experiments.program` | O CHECK aceita só esses 4. Ver lacunas na seção 4 |
| Investigação (ex.: BRE, CLD Flame, BASS-II/Olson, Saffire VI) | `experiments.name` | Uma linha por investigação, ligada ao programa |
| Teste (FLEX-002, Run #204, Saffire VI-3, amostra II-5) | `experimental_runs` (`run_date`, `notes`, `material_id`) | `notes` guarda o desfecho e as anomalias (ex.: contaminação das agulhas do FLEX) |
| Combustível ou amostra (metanol, n-heptano, PMMA, SIBAL, Nomex) | `materials` | `standard_nomenclature`: nome químico ou comercial padronizado |
| Atmosfera e fluxo (O₂, pressão, velocidade do ar) | `experiment_conditions` | **Atenção às unidades** (seção 2) |
| Resultado numérico (K, De, taxa de espalhamento, HRR, ΔCO) | `measurements` | `origin_category = 'Published'`, com `source_document_id` e `source_page` |
| Trecho de texto para o RAG | `document_chunks` (`page_number`, `section`) | A página do chunk deve ser a mesma convenção (página do PDF) |

## 2. Conversão de unidades

O schema usa **O₂ em % (0 a 100)**, **velocidade em m/s** e **pressão em atm**. As fontes usam outras unidades:

| Na fonte | Exemplo | Para o schema | Resultado |
|---|---|---|---|
| fração molar de O₂ | 0,21 [20150023456] | × 100 | 21 (%) |
| % de O₂ em volume | 13,6% [20160000593] | igual | 13,6 |
| cm/s | 20 cm/s [Saffire] | × 0,01 | 0,20 m/s |
| mm/s (taxa de espalhamento) | 1,8 mm/s | é medida, não condição | `unit = 'mm/s'` |
| mmHg | 762 mmHg [20150023456 p.26] | ÷ 760 | 1,003 atm |
| kPa | 54,6 kPa [20240002981 p.3] | ÷ 101,325 | 0,539 atm |
| ppm de CO/CO₂ | 308 ppm | medida | `unit = 'ppm'` |
| mmHg de pCO₂ | 3,51 mmHg | medida | `unit = 'mmHg'` |

**Regra proposta (Decisão a confirmar com o Marco):**
- o registro original, com a unidade original, fica em `raw` (JSONB) e nunca é perdido;
- a coluna normalizada recebe o valor convertido;
- a conversão de unidade **não** muda `origin_category`: o dado continua `Published`, só mudou de escala;
- um **cálculo nosso** (ex.: HRR por Huggett a partir de um ΔO₂) vira `Derived`.

## 3. Exemplos de linha (valores publicados, ainda não inseridos)

**FLEX, Run #204** [20130014061 p.5]:
- `experimental_runs`: experimento FLEX, material metanol, `notes` = "gota livre; extinção difusiva".
- `experiment_conditions`: `o2_concentration` = 20 (o artigo diz "air (20% O₂ and 79% N₂)"; ver nota abaixo), `pressure_atm` = 1, `flow_velocity_ms` = 0 (ambiente parado).
- `measurements`:
  - `initial_diameter` = 2,75 mm;
  - `extinction_diameter` = 1,10 mm;
  - ambos com `origin_category` = Published, `source_page` = 5, `quality_status` = EXTRACTED.
- Nota: o artigo escreve 20% de O₂ para "ar". No TP, o ar é 0,21 [20150023456 p.15]. **Gravar o que está escrito e marcar `PENDING_VALIDATION`.**

**Saffire VI-3** [20240002981 p.3, p.6]:
- `experiment_conditions`: `o2_concentration` = 30,3, `pressure_atm` = 0,539 (de 54,6 kPa), `flow_velocity_ms` = 0,20.
- `measurements`:
  - `burn_duration` = 780 s;
  - `peak_heat_release_rate` = 3080 W;
  - `co_increase_far_field` = 308 ppm;
  - `co2_partial_pressure_increase` = 3,51 mmHg;
  - todos Published, `source_page` = 6.

**Nomes de variável sugeridos** (snake_case em inglês, unidade na coluna `unit`):
- FLEX: `initial_diameter`, `extinction_diameter`, `burning_rate_constant`, `flame_standoff_ratio`, `burn_duration`, `test_end` (o desfecho fica em `notes`, porque `value` é numérico);
- espalhamento: `flame_spread_rate`;
- calor e gases: `peak_heat_release_rate`, `total_heat_release`, `co_increase`, `co2_increase`;
- extinção: `extinction_flow_velocity`.

**Séries temporais:**
- os PDFs **não** trazem séries numéricas, só gráficos;
- séries vêm do PSI;
- `elapsed_time_seconds` fica nulo para valores únicos de teste.

## 4. Lacunas do schema que este estudo revelou

Para decidir com o Marco. O CLAUDE.md permite extensões, mas não remoções.

1. **`experiments.program` não aceita SoFIE, FLARE, SPICE nem CFI.**
   - Hoje o FLEX-2 entra como FLEX.
   - Sugestão: manter os 4 programas do desafio e registrar a investigação em `experiments.name`.
   - Se o enunciado de 28/10 citar SoFIE, ampliar o CHECK numa migração nova (`0002`).
2. **Faltam colunas de condição** que mudam o resultado:
   - fração de diluente (CO₂, He, N₂);
   - direção do fluxo (concorrente ou oposta);
   - nível de gravidade (µg, 1 g, torre de queda);
   - geometria e espessura da amostra.
   - Sugestão: colunas opcionais em `experiment_conditions` ou um JSONB `extra_conditions`, decidido numa migração.
3. **Desfecho categórico** (Extinction, Disruption, Completion, "não acendeu"): não cabe em `measurements.value`. Sugestão: coluna `outcome` em `experimental_runs`.
4. **Incerteza da medida** (ex.: ±50 µm na gota, ±5 mm/s na velocidade crítica): sem coluna. Sugestão: `uncertainty` em `measurements`.

## 5. Simulação do Tex (dados sintéticos)

- O backend gera telemetria **simulada**: tudo marcado como `origin_category: "Synthetic"`, e a tela avisa.
- _Hipótese (não implementar sem conversar com o Marco, dono do backend):_ as faixas da simulação podem se inspirar nas faixas publicadas, para não mostrar números absurdos. Por exemplo:
  - O₂ de 21 a 34%;
  - pressão de 0,5 a 1 atm;
  - fluxo de 0 a 0,4 m/s;
  - CO subindo centenas de ppm;
  - temperatura longe do fogo quase estável.
  - **Mesmo assim, o resultado continua `Synthetic`.** Inspirar-se numa faixa não valida o modelo.

## 6. O que podemos e não podemos dizer no pitch

**Pode dizer (com fonte):**
- "Em microgravidade a chama não sobe. O oxigênio chega por difusão e pela ventilação."
- "Chamas pequenas queimaram por minutos na ISS sem fluxo de ar" [20210022542 p.4; 20140011099 p.55].
- "Nos testes em escala real do Saffire, o CO e o CO₂ preocuparam mais que o calor, e o detector de fumaça demorou 981 s" [20240002981 p.5-6].
- "Para o PMMA, o limite de oxigênio em microgravidade foi menor que o do teste padrão em 1 g" [20160000593 p.18].
- "Os dados de referência vêm da NASA (NTRS e PSI), com página citada."

**Não pode dizer:**
- "Telemetria ao vivo da ISS." É simulação com dados sintéticos.
- "Prevemos incêndios reais." Não há validação física.
- "Em microgravidade o fogo se apaga sozinho." Falso (BRE, BASS).
- "Toda chama em microgravidade é esférica." Falso: com fluxo ela se alonga, e perto da extinção vira um hemisfério.
- "Microgravidade é sempre mais perigosa." Depende do material e do fluxo (silicones do Saffire-II × PMMA do BASS-II).
- "MCP" para o endpoint `/api/v1/mcp/context`. Hoje é um endpoint de contexto (regra do CLAUDE.md).

## 7. Próximos passos de dados (a partir de 14/11)

1. Checar no PSI quais investigações destes programas têm dados para download, e em que formato.
2. Ingerir os 14 documentos pelo pipeline NTRS (etapas 1, 2, 10 e 11 já existem).
   - As etapas 3 a 9 (extração de entidades) podem usar esta pasta como "gabarito" para conferir a extração.
3. Começar a extração de medições pela **Tabela IX do FLEX** [20150023456 p.26 em diante] e pelas **Tabelas 1 e 2 do Saffire VI** [20240002981 p.3, p.6]. São tabelas limpas e citáveis.
