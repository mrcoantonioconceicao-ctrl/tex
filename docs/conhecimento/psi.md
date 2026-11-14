# Inventário do PSI: investigações de combustão

Levantado em 28/10/2026 na busca "combustion" do portal (https://psi.nasa.gov/physci/repo/search?q=combustion), que é o link de dados do enunciado ([enunciado.md](enunciado.md)). Só **metadados**: nenhum arquivo de dados foi baixado. Antes de 14/11, baixar as tabelas é decisão do time (regra do CLAUDE.md).

## Como o PSI expõe os dados (fato)

- **API JSON pública e sem login**, a mesma que o portal usa:
  - Busca (Elasticsearch): `GET https://psi.nasa.gov/geode-py/ws/repo/search?term=combustion&source=psi&type=investigation&from=0&size=100`. Os resultados ficam em `hits.hits[]._source`, e o campo `Accession` traz o código, ex.: `PSI-25`.
  - Metadados de uma investigação: `GET https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-25`. Campos úteis:
    - `investigationAcronym`, `title`, `objective`, `approach`, `hypothesis`, `description`;
    - `projectType`, `subResearchArea`, `experimentHardware`;
    - `investigationStartDate` e `investigationEndDate`, no formato `MM-DD-AAAA`;
    - `doi`, `licenseIdentifier`, `publications[]` (com DOI), `totalFileSize` (em bytes);
    - `experimentalTable[]`, uma lista de arquivos CSV com `file_name`, `file_size` e `s3_path`.
  - Download: `GET https://psi.nasa.gov/geode-py/ws/studies/PSI-25/download?file=<file_name>&version=<n>&redirect=false`. Devolve um link S3 assinado e temporário.
- **Licença:** 25 das 26 investigações são **CC0-1.0**; uma vem sem licença no metadado. O PSI pede que se cite o DOI de cada investigação, e o link "Cite this Investigation" fica na página dela.
- **Volume:** os dados brutos (vídeo, imagens, sensores) somam cerca de **14 TB**. As **tabelas experimentais** em CSV, uma linha por teste, somam **cerca de 230 KB**. São elas o alvo da ingestão, não os dados brutos.
- **Exemplo:** a tabela do BASS-II (PSI-25) tem 130 testes. As colunas incluem PI, data, amostra (ex.: filme de PMMA de 100 µm e 2 cm de largura), ajuste do ventilador e do ar, O₂ inicial e final (% vol.), CO₂ inicial e final (% vol.) e CO inicial e final (ppm).

## As 26 investigações

Microgravidade (M) ou solo (S). O tamanho é o total de arquivos da investigação, e "CSV" é o tamanho da tabela experimental.

| PSI | Sigla | Tipo | Hardware | Total | CSV | Pubs | Citada no enunciado |
|---|---|---|---|---|---|---|---|
| PSI-26 | BASS | M | MSG | 164 GB | 4,7 KB | 10 | sim |
| PSI-25 | BASS-II | M | MSG | 275 GB | 16,6 KB | 17 | sim |
| PSI-98 | SAFFIRE-I | M | Cygnus | 12 GB | 0,5 KB | 6 | sim |
| PSI-99 | SAFFIRE-II | M | Cygnus | 17 GB | 2,0 KB | 7 | sim |
| PSI-100 | SAFFIRE-III | M | Cygnus | 35 GB | 0,2 KB | 3 | sim |
| PSI-102 | SAME | M | hardware de diagnóstico de fuligem | 0,7 GB | 0,3 KB | 16 | sim |
| PSI-101 | SAME-R | M | idem | 6 GB | 5,7 KB | 6 | sim |
| PSI-47 | DAFT / DAFT-2 | M | TSI P-Trak | <0,1 GB | 0,5 KB | 2 | sim |
| PSI-69 | FLEX | M | CIR + MDCA | 924 GB | 24,8 KB | 51 | sim |
| PSI-68 | FLEX-2 | M | CIR + MDCA | 1.225 GB | 1,0 KB | 48 | sim |
| PSI-39 | CFI | M | CIR + MDCA | 719 GB | 7,8 KB | 7 | sim |
| PSI-20 | ACME BRE | M | CIR + ACME | 2.036 GB | 1,1 KB | 16 | sim |
| PSI-159 | ACME CFI-G | M | CIR + ACME | 2.086 GB | 61,6 KB (2 CSVs) | 2 | sim |
| PSI-22 | ACME E-FIELD Flames | M | CIR + ACME | 950 GB | 2,5 KB | 25 | sim |
| PSI-21 | ACME CLD Flame | M | CIR + ACME | 2.006 GB | 2,5 KB | 18 | só como "ACME" |
| PSI-23 | ACME s-Flame | M | CIR + ACME | 782 GB | 2,5 KB | 44 | só como "ACME" |
| PSI-10 | ACME Flame Design | M | CIR + ACME | 2.180 GB | 44,2 KB (2 CSVs) | 33 | só como "ACME" |
| PSI-107 | SPICE | M | MSG | 7 GB | 31,2 KB | 9 | sim |
| PSI-106 | SLICE | M | (não informado) | 73 GB | 0,7 KB | 5 | sim |
| PSI-108 | STDCE-1 | M | STDCE | 24 GB | 13,7 KB (2 CSVs) | 15 | não (convecção por tensão superficial) |
| PSI-117 | (CFD de chama fria, dados do FLEX) | S |, | 0,1 GB |, | 10 | não |
| PSI-62 | (modelo de espalhamento de chama, compara com o BASS) | S |, | <0,1 GB |, | 4 | não |
| PSI-60 | (análise dos dados do SPICE) | S |, | <0,1 GB |, | 1 | não |
| PSI-142 | (chamas frias em contrafluxo) | S | laboratório do PI | <0,1 GB | 0,7 KB | 12 | não |
| PSI-115 | (uso dos dados do SAME) | S |, | 0,3 GB |, | 0 | não |
| PSI-181 | (soldas Pb-Sn, solo × microgravidade) | S |, | 523 GB | 0,7 KB | 0 | não (fora do tema) |

## O que isso muda para o Tex

- **O que falta (fato):**
  - **Saffire IV a VI não estão no PSI**, só os I a III. Os números do nosso painel de CO vêm do NTRS (20240002981), o que continua válido, mas a fonte é outra.
  - O **LUCI** e o **FM2** ainda não estão no PSI, então não há dados de gravidade parcial.
- **_Decisão_ proposta, ingestão do PSI em quatro passos:**
  1. busca na API;
  2. metadados de cada investigação, guardados no `raw` JSONB;
  3. download só das tabelas experimentais (CSV);
  4. normalização para `experiments`, `experimental_runs`, `experiment_conditions` e `measurements`, com `origin_category: "Measured"` e `source` igual ao DOI do PSI.

  Tudo cabe em menos de 1 MB e é idempotente pelo `Accession` mais a versão.
- **_Decisão_ proposta, base do resumo por IA:** os campos `objective`, `approach` e `hypothesis` de cada investigação, mais as publicações com DOI.
- **Confirmado em 14/11** (era hipótese): as colunas dos CSVs variam por investigação. Ver "Tabelas baixadas em 14/11".
- **_Decisão_ (Willian e Marco, 31/10):** os 25 CSVs só são baixados a partir de 14/11, mas o código do download (`npm run download:psi`, em `ingestion/src/psi-download.ts`) fica pronto antes, testado só com dado sintético. A CLI recusa baixar antes de 14/11.

## Tabelas baixadas em 14/11 (fato)

Baixadas com `npm run download:psi` no primeiro dia do hackathon: **25 CSVs, 271 KB**, todos com SHA-256 em `experiment_files`. O formato do link assinado, que era hipótese em `psi-download.ts`, funcionou de primeira com o PSI-25. Os arquivos ficam em `ingestion/data/psi/`, fora do git.

**Colunas principais por investigação** (linhas = linhas do arquivo, com o cabeçalho):

| PSI | Sigla | Linhas | Colunas que interessam ao Tex |
|---|---|---|---|
| PSI-69 | FLEX | 275 | pressão (mmHg), frações molares de O₂, N₂, CO₂ e He, diâmetro inicial e de extinção (mm), taxa de queima, tempo de queima (s), desfecho (`Test end`) |
| PSI-68 | FLEX-2 | 9 | combustível, diâmetro inicial (mm), mistura, fração molar de O₂, pressão (atm), temperatura (°C), velocidade do fluxo (cm/s) |
| PSI-39 | CFI | 88 | pressão, O₂, N₂, He, fibra, combustível |
| PSI-25 | BASS-II | 130 | amostra, ventilador e ar, O₂ inicial e final (% vol.), CO₂ inicial e final (% vol.), CO inicial e final (ppm) |
| PSI-26 | BASS | 123 | data, teste, amostra, material. **Sem condições de teste** |
| PSI-98 | SAFFIRE-I | 5 | espessura, comprimento e largura (cm), fluxo de ar (cm/s), % O₂, potência e tempo de ignição, tempo de queima, direção do fluxo |
| PSI-99 | SAFFIRE-II | 16 | as mesmas do I, mais comprimento queimado e taxa de espalhamento em µg e em 1 g |
| PSI-100 | SAFFIRE-III | 3 | dimensões, fluxo de ar, direção. Sem unidades no cabeçalho |
| PSI-20 | ACME BRE | 19 | tamanho do queimador (mm), garrafa de combustível, O₂ (%), chamas acesas |
| PSI-10 | ACME Flame Design | 121 + 208 | XO₂, vazões (mg/s), pressão inicial, final e média (atm), Zst, Tad (K). Um CSV para chama normal e outro para inversa |
| PSI-159 | ACME CFI-G | 1.016 + 180 | XO₂, combustível, pressão (bar), TFP, Tad (K), tempo de queima, desfecho (autoextinção ou fim do fluxo), chama fria |
| PSI-21, 22, 23 | ACME CLD, E-FIELD, s-Flame | 19 a 33 | dia, combustível, concentração, chamas acesas, notas |
| PSI-107 | SPICE | 470 | bocal (mm), vazão de combustível (sccm e mg/s), vazão de ar (cm/s) |
| PSI-106 | SLICE | 13 | só data e combustível |
| PSI-102 | SAME | 9 | material, fluxo de ar (cm/s), perda de massa (mg/min), tempo de envelhecimento |
| PSI-101 | SAME-R | 110 | velocidade de entrada (cm/s), Rt/R0, duração e tempos de envelhecimento e mistura (s) |
| PSI-47 | DAFT | 3 | sessão, hardware, material, local da amostra |
| PSI-108 | STDCE-1 | 39 + 39 | fora do tema (convecção por tensão superficial). Dois arquivos com o mesmo nome e conteúdo diferente |
| PSI-142, PSI-181 | (solo) | 9 cada | índice de dados e amostras de solda, não são tabelas de testes |

**Cuidados de qualidade para a normalização:**
- **Codificação mista:** 4 arquivos em UTF-8 com BOM (BASS, BASS-II, STDCE-1, PSI-142), o FLEX em codificação estendida não UTF-8 (provavelmente Windows-1252), o SLICE com fim de linha CRLF e o resto em ASCII. O leitor precisa remover o BOM e detectar a codificação.
- **Unidade no texto do cabeçalho**, em formatos diferentes: `Air Flow (cm/s)`, `Ambient pressure; mmHg`, `Pressure` sem unidade. Mapear cabeçalho a cabeçalho, nunca adivinhar.
- **O₂ em escalas diferentes:** fração molar (FLEX, FLEX-2, ACME `XO2`) e porcentagem (BASS-II, Saffire, BRE). Converter para % no `experiment_conditions` e guardar o original no `raw`.
- **Cabeçalhos com erro de digitação ou caractere perdido**, ex.: `Samle Thickness` e `?-g Burn Length` (o µ virou `?`) no SAFFIRE-II, e espaços sobrando no fim.
- **Valores suspeitos** para marcar como `PENDING_VALIDATION`, não para corrigir. Ex.: o teste B2 do BASS-II registra O₂ final de 1,6% contra 22,2% no início.
- **Origem:** é dado de experimento, então `origin_category = "Measured"` com o arquivo de origem (`source_file_id`), como o checklist pede.
