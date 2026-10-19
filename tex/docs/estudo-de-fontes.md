# Estudo de fontes de dados, Tex Labs (NASA Space Apps 2026)

Levantamento feito em 19/10/2026, na fase de estudo (antes de 14/11/2026).
Nenhum dado aqui foi inventado: tudo aponta para a fonte original.

## 1. NTRS, NASA Technical Reports Server (artigos e relatórios)

- Site: https://ntrs.nasa.gov
- API pública, testada sem autenticação:
  `GET https://ntrs.nasa.gov/api/citations/search?q=<termo>&page.size=<n>`
  - Exemplo: `q=microgravity flame spread` retornou 194 resultados.
  - Chaves da resposta: `stats` (total etc.), `results`, `aggregations` (contagens por autor, centro, ano, tipo STI, categoria, palavra-chave).
  - Campos de cada resultado: `id`, `title`, `abstract`, `keywords`, `subjectCategories`, `authorAffiliations`, `created`, `modified`, `publications[].publicationDate`, `stiType`, `center`, `downloads` (PDFs), `downloadsAvailable`.
- Documentação da API: https://ntrs.nasa.gov/api/openapi/
- Termos de uso (PDF do STI): https://sti.nasa.gov/docs/20221122_OpenAPI_Documentation.pdf
  - A API pode ter limite de volume de chamadas.
  - Referenciar cada documento por `https://ntrs.nasa.gov/citations/{id}`, em vez de hospedar cópias dos PDFs.
- O que entrega: texto técnico. Serve de base para o GraphRAG, não para telemetria.

## 2. PSI, Physical Sciences Informatics (dados de experimentos da ISS)

- Página institucional: https://science.nasa.gov/physical-sciences-informatics-psi
- Busca no repositório: https://psi.nasa.gov/physci/repo/search?q=&data_source=psi&data_type=investigation
- Ficha no re3data: https://www.re3data.org/repository/r3d100014699
- Repositório aberto de ciências físicas. Combustion Science é uma das seis disciplinas. Guarda dados brutos e reduzidos, metadados, relatórios e publicações.
- **Pendente (checar à mão no navegador):** quais investigações de combustão existem, se o download exige login e os formatos dos arquivos. O portal é carregado por JavaScript e não foi possível ler o conteúdo automaticamente.

## 3. Experimentos relevantes

| Experimento | O que estuda | Onde achar |
|---|---|---|
| FLEX / FLEX-2 | Gotas de combustível queimando (MDCA, dentro do CIR) | Relatório com os primeiros 284 testes: https://ntrs.nasa.gov/citations/20150023456 |
| ACME | Chamas de gás perto do limite de inflamabilidade; fuligem | Operações do CIR (GRC): https://gipoc.grc.nasa.gov/wp/fcf-cir |
| Saffire I, VI | Incêndios em escala real dentro das naves Cygnus | Ver links abaixo |

Saffire, a fonte mais próxima do cenário "incêndio no habitat":
- Medições citadas nos artigos: taxa de propagação da chama, temperatura, calor radiante, liberação de calor (até cerca de 10 kW) e concentrações de O₂, CO, CO₂, HF e HCl.
- Até agora esses números só apareceram dentro de artigos, não como datasets prontos.
- ICES 2024 (Saffire VI): https://ntrs.nasa.gov/api/citations/20240002981/downloads/Saffire-ICES-2024-ICES-365-accepted%20final.pdf
- ICES 2021: https://ntrs.nasa.gov/citations/20210011521
- Saffire IV e V, resultados preliminares: https://ttu-ir.tdl.org/items/ee71c701-f97a-437e-be4a-1193c517cadf
- Resultados de testes de inflamabilidade em grande escala: https://ttu-ir.tdl.org/items/61d289c1-a167-4029-8e7d-ba75de043d84

## 4. Observações

- Não há página pública do desafio "Free-Fall Flame". Os enunciados saem em 28/10/2026 e devem listar os dados oficiais.
- O repositório já tem `docs/api-spec.yaml` (do backend). Usar como base para os tipos TypeScript do front.

## 5. Próximos passos

### Até 14/11 (só estudo e preparo)
1. Checar o portal PSI à mão: investigações de combustão, login, formatos.
2. Ler o enunciado em 28/10 e listar os dados e recursos indicados pela NASA.
3. Confirmar com o Marco que o Axum vai servir o build estático do front.
4. Preparar o ambiente: Node LTS, Rust/Cargo, conta Azure com PostgreSQL.
5. Rascunhar no papel o modelo de dados da ingestão: documento NTRS → trechos → entidades (experimento, material, O₂, taxa de propagação).

### A partir de 14/11
1. Pipeline NTRS: buscar pela API, filtrar, baixar PDFs, extrair o texto e gravar no PostgreSQL com o link de origem.
2. Pipeline PSI: ingerir as séries de dados e os metadados que puderem ser baixados.
3. Front (Vite + React + TS): tipos dos endpoints, mocks MSW, camada única de API, telas de telemetria, métricas e consulta MCP.
4. Integrar com o backend real e abrir o PR.
