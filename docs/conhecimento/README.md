# Base de conhecimento: combustão em microgravidade

Estudo dos 14 documentos da NASA (NTRS) escolhidos pelo time para o desafio "Free-Fall Flame". Feito em 22/10/2026, ainda na fase de estudo (antes de 14/11/2026).

Esta pasta serve para três coisas:
1. Consulta rápida do time (Willian e Marco) durante o hackathon.
2. Contexto para assistentes de IA. Basta pedir para ler esta pasta antes de responder sobre o domínio.
3. Base para o pitch, sem exageros. Cada número tem documento e página.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| [enunciado.md](enunciado.md) | Enunciado oficial (28/10): o que a NASA pede, investigações citadas, recursos e confronto com o Tex |
| [psi.md](psi.md) | Inventário das 26 investigações de combustão do PSI (28/10): API, tabelas experimentais, tamanhos, o que falta |
| [visao-geral.md](visao-geral.md) | Física da chama em microgravidade, instalações (CIR, MSG, Cygnus), programa da NASA, onde estão os dados (PSI) |
| [flex.md](flex.md) | FLEX: gotas de combustível, extinção, limite de oxigênio, chamas frias |
| [acme.md](acme.md) | ACME: chamas de gás, fuligem, campo elétrico, autoextinção |
| [saffire.md](saffire.md) | Saffire I a VI: incêndios em escala real na Cygnus, CO/CO₂, detecção de fumaça |
| [bass.md](bass.md) | BASS e BASS-II: sólidos, velocidade do ar, mapa de inflamabilidade em "U" |
| [glossario.md](glossario.md) | Termos português ↔ inglês |
| [pontes-com-o-tex.md](pontes-com-o-tex.md) | Como esses dados entram no schema PostgreSQL do Tex, conversão de unidades, linhagem, o que dizer no pitch |

## Convenções

- **Citação:** `[ID p.N]`, onde ID é o número NTRS e N é a página do arquivo PDF, contando a capa. Em relatórios técnicos (TP/TM) a página impressa é outra. Ex.: no TP do FLEX, página impressa 1 = PDF p.7.
- **Três níveis, sempre separados** (regra do CLAUDE.md):
  - **Fato:** está no documento citado.
  - **Hipótese:** extrapolação nossa ou pergunta aberta dos próprios autores. Vem marcada como _Hipótese_.
  - **Decisão Tex Labs:** escolha de arquitetura do time. Vem marcada como _Decisão_.
- **Divergências entre fontes** ficam registradas em cada arquivo, sem escolher um valor "certo" por conta própria.
- Unidades no original. A conversão para o schema está em `pontes-com-o-tex.md`.

## Os 14 documentos

Links de citação: `https://ntrs.nasa.gov/citations/<ID>`.

| ID | Programa | Tipo | Título resumido | Ano |
|---|---|---|---|---|
| 20150023100 | Visão geral | Slides | NASA Microgravity Combustion Program (D. Urban, GRC) | 2015 |
| 20250002347 | Visão geral | Pôster | Fire and flame research in the CIR on the ISS (D. Stocker) | 2025 |
| 20090014812 | FLEX | Ficha | MDCA-FLEX, descrição da investigação (planejamento) | 2009 |
| 20130014061 | FLEX | Artigo | Methanol Droplet Combustion in Oxygen-Inert Environments in Microgravity (Nayagam et al.) | 2013 |
| 20150023456 | FLEX | Relatório NASA/TP-2015-216046 | Detailed Results From FLEX, March 2009 to December 2011 (Dietrich et al.), 314 p. | 2015 |
| 20210015913 | ACME | Pôster (imagem) | ACME on the ISS (PS-03403) | 2021 |
| 20220015583 | ACME | Pôster (imagem) | ACME, 13th US National Combustion Meeting (PS-03790) | 2023 |
| 20210022542 | ACME | Slides | Recent Research on Flames of Gaseous Fuel Aboard the ISS (D. Stocker, JASMAC-33) | 2021 |
| 20170001636 | Saffire | Artigo | The Spacecraft Fire Experiment (Saffire): Objectives, Development and Status (Schoren et al.) | 2016/17 |
| 20180005168 | Saffire | Slides | Saffire: A Novel Approach to Study of Spacecraft Fire Safety (Urban et al., ASGSR) | 2017 |
| 20240002981 | Saffire | Artigo ICES-2024-365 | Preliminary Results from the Saffire VI Experiment (Urban et al.) | 2024 |
| 20140011099 | BASS | Slides | Thickness and Fuel Preheating Effects... from the BASS Experiment (Ferkul et al.) | 2013 |
| 20160000593 | BASS | Pôster | Combustion of Solids in Microgravity: Results from BASS-II (Ferkul et al.) | 2014 |
| 20210011385 | BASS | Relatório NASA/TM-20210011385 | BASS-II Summary Report (Olson et al.), 144 p. | 2021 |

## Limites deste estudo

- Os dois pôsteres do ACME são só imagem (o PDF não tem texto). Foram lidos visualmente e citados como `p.1`.
- Os dois relatórios longos foram lidos nas partes de resumo, métodos, resultados e conclusões. Os apêndices com centenas de gráficos não foram transcritos. A Tabela IX do FLEX (resultados teste a teste) foi lida em parte.
- Nenhum dado numérico bruto (séries temporais) está nesses PDFs. Os dados brutos ficam no **PSI** (psi.nasa.gov, com cadastro) [20150023456 p.22; 20210015913 p.1].
- Esta pasta não substitui os enunciados oficiais, que saem em 28/10/2026.
