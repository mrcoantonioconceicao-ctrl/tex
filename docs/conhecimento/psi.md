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
- **_Hipótese_:** as colunas dos CSVs variam por investigação (o BASS-II mede O₂/CO₂/CO; o FLEX deve trazer diâmetro de gota e diluente). Isso precisa ser conferido CSV a CSV antes de fechar a migração 0002.
- **Pendência com o Marco:** decidir se baixamos os 25 CSVs (cerca de 230 KB) antes de 14/11. Pela regra do CLAUDE.md, coletar dados do desafio é decisão conjunta.
