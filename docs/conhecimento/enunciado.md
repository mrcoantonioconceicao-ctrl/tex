# Enunciado oficial do desafio

Lido em 28/10/2026, no dia em que saiu, na página oficial: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/ (abas Details e Resources). A NASA avisa que mais recursos podem entrar até o início do hackathon, então vale reler a página antes de 14/11.

Este arquivo é um resumo em português, não uma tradução. Em caso de dúvida, vale o texto da página.

## Identificação

- **Nome oficial:** "Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data". O nome que usávamos antes ("Free-Fall Flame… AI-Driven") estava errado.
- **Dificuldade:** intermediária e avançada. **Assunto:** exploração espacial.

## O que pede

Um **dashboard web com IA** que resume, ranqueia e interpreta investigações de combustão em microgravidade para gerar conclusões sobre segurança contra incêndio na exploração humana do espaço.

A base de dados indicada é o **PSI (Physical Sciences Informatics)**. A NASA reconhece que o volume de dados é grande: difícil de achar, mais difícil de comparar e mais difícil ainda de interpretar. Resolver isso é o problema central.

O enunciado sugere três funções, sem torná-las obrigatórias:
1. Identificar as investigações mais relevantes para cada ambiente habitado: naves, estações espaciais, bases na Lua e em Marte e rovers pressurizados.
2. Extrair dados que apoiem a modelagem preditiva de inflamabilidade e de cenários de incêndio.
3. Destacar pesquisas que ajudem a desenvolver controles e equipamentos de segurança contra incêndio.

Opcional: mostrar aplicações na Terra, como extintores de névoa d'água, detectores de fumaça e equipamentos de bombeiro derivados de tecnologia da NASA.

Fora do escopo: foguetes e propelentes. A combustão dentro de um motor é rápida demais para depender da gravidade.

## Contexto que o enunciado dá (fatos citados pela NASA)

- **Os três pilares da segurança contra incêndio na NASA:** prevenção, detecção e supressão.
  - **Prevenção:** controle de fontes de ignição e escolha de materiais, que depende de conhecer os limites de inflamabilidade. Investigações citadas: BASS, BASS-II e Saffire I a III.
  - **Detecção:** SAME e SAME-R.
  - **Supressão:** FLEX, com diluição da atmosfera da câmara por CO₂ e hélio.
- **Incidentes citados como motivação:** Apollo 1 (1967), Apollo 13, o incêndio na Mir (1997) e um alarme de fumaça na Artemis II.
- **Oxigênio na Lua:** o traje espacial usa 100% de O₂ a 4,3 psi; a Terra está a 14,7 psi. Para encurtar a pré-respiração, a base lunar e os rovers devem operar com **O₂ de 30% ou mais e pressão de 10,2 psi (~70 kPa) ou menos**. É mais de 40% de aumento na concentração de O₂ em relação à Terra, o que deixa os materiais bem mais inflamáveis.
- **O₂ mais alto testado em microgravidade:** no CFI-G (ACME), com até 85% de O₂ saindo de um queimador esférico ("chama de dentro para fora").
- **Gravidade parcial:** **não há dados no PSI**. Devem entrar no futuro pelo LUCI e pelo FM2. O E-FIELD Flames (ACME) imitou gravidade parcial com campo elétrico. Resultados em microgravidade e em gravidade normal podem servir de limites para o caso intermediário.

## Investigações e hardware citados

| Hardware | Investigações | Tipo de combustível |
|---|---|---|
| CIR + módulo ACME | as 6 do ACME, entre elas BRE, CFI-G e E-FIELD Flames | gás |
| CIR + MDCA | FLEX, FLEX-2, CFI | gotas de líquido |
| MSG + duto de fluxo do SPICE | BASS, BASS-II, SPICE, SLICE | sólido e gás |
| Cygnus (fora da ISS) | Saffire I a III | sólido em escala real |
| Detecção | SAME, SAME-R; o mesmo instrumento foi usado para poeira no DAFT e no DAFT-2 | aerossol |

O BRE queima gás, mas estuda a inflamabilidade de materiais em atmosfera parada em função das propriedades do material. Há outras investigações de combustão no PSI que são relevantes, mas de forma menos direta.

## O que exibir de cada investigação (sugestões)

- **Público-alvo:** professores, alunos de pós-graduação e de graduação, pesquisadores e engenheiros aeroespaciais.
- **Campos por investigação:**
  - objetivo do experimento;
  - combustível, com forma e tamanho da amostra ou do queimador;
  - condições de teste (% de O₂, velocidade do ar);
  - variáveis: o que mudou e o que ficou igual entre os testes;
  - sensores e tipos de medição.
- **Comparação entre investigações:** semelhanças e diferenças.

## Recursos oficiais (aba Resources)

| Recurso | Link |
|---|---|
| PSI, busca "combustion" (fonte de dados do desafio) | https://psi.nasa.gov/physci/repo/search?q=combustion |
| NASA Combustion Science (Glenn) | https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/ |
| ScienceCasts: combustão na ISS (vídeo de 2018) | https://www.youtube.com/watch?v=W1oXykoz9zg |
| A Researcher's Guide to ISS Combustion Science (2015) | https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/ |
| Apollo 1 | https://sma.nasa.gov/sma-disciplines/accllp/apollo-1 |
| Apollo 13 | https://sma.nasa.gov/sma-disciplines/accllp/apollo-13 |
| Incêndio na Mir | https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/ |
| Spinoffs: tanques de ar, detector de fumaça, roupa de bombeiro | https://spinoff.nasa.gov/node/9582, https://spinoff.nasa.gov/node/9407, https://spinoff.nasa.gov/node/9918 |

## Confronto com o Tex (28/10)

_Decisão_ e _Hipótese_ seguem as convenções do [README](README.md).

**O que já atende:**
- O painel de predição de CO (Saffire IV a VI) é um caso de "modelagem preditiva de inflamabilidade e de cenários de incêndio". Os cenários de 26% e 31% de O₂ caem na faixa prevista para a base lunar.
- A separação entre fato e hipótese, com fonte e página, serve bem para um público de pesquisadores.
- Os estudos de FLEX, ACME, Saffire e BASS desta pasta cobrem boa parte das investigações citadas.

**Lacunas:**
1. **Fonte de dados.** O enunciado aponta o **PSI**, e nós estudamos o NTRS até aqui. Inventariar o PSI à mão é a prioridade.
2. **Investigações.** O CHECK de `experiments.program` aceita só FLEX, ACME, Saffire e BASS. Faltam SAME, SAME-R, SPICE, SLICE, DAFT e CFI. BASS-II, FLEX-2 e os sub-experimentos do ACME podem ficar como experimentos dentro do programa.
3. **Campos.** Faltam objetivo, geometria do combustível, sensores e hardware (CIR, MDCA, MSG). Junto com as lacunas já listadas (diluente, direção do fluxo, outcome, incerteza), isso entra na migração 0002.
4. **IA.** É o núcleo do desafio (resumir, ranquear, interpretar), e hoje o `engine.rs` é stub.
5. **Foco da demo.** Telemetria e supressão simulada não aparecem no enunciado. _Hipótese:_ funcionam como contexto, não como entrega principal.

**_Decisão_ a tomar com o Marco:** colocar no centro um catálogo das investigações do PSI com ranqueamento por ambiente (ISS, Lua, Marte, rover) e resumo por IA, com a predição de CO como um módulo desse catálogo. Até 14/11 vale a regra do desafio: só estudo e planejamento.
