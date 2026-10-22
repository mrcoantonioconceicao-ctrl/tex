# FLEX: Flame Extinguishment Experiment (gotas de combustível)

Fontes:
- 20090014812: ficha de planejamento, 2009.
- 20130014061: artigo sobre metanol, 2013.
- 20150023456: NASA/TP-2015-216046, com os resultados detalhados.
- 20150023100: slides do programa (chamas frias).

## 1. O que é e por que importa

- **Objetivo declarado:**
  - medir a eficácia de supressores gasosos em microgravidade;
  - quantificar como diferentes atmosferas de exploração afetam a supressão;
  - orientar a escolha do supressor das próximas naves tripuladas [20090014812 p.1].
- **Por que gotas?** A geometria esférica reduz o problema a uma dimensão. Isso permite comparar experimento e teoria em detalhe e validar a cinética química e o transporte. Desses mecanismos validados saem modelos reduzidos para simular incêndios reais em naves [20090014812 p.1; 20150023456 p.8].
- **Limitação assumida pelos autores:** a gota é um combustível simples e bem caracterizado, mas **não representa um combustível prático** como PMMA ou papel [20090014812 p.2].

## 2. Hardware e operação

- Feito no MDCA, dentro do CIR, no módulo Destiny da ISS. Foi o **primeiro experimento do CIR** [20150023456 p.8].
- Sequência de cada teste [20150023456 p.11]:
  1. agulhas opostas formam a gota;
  2. as agulhas recuam e a gota fica livre (ou presa numa fibra de 80 µm);
  3. dois fios quentes acendem a gota;
  4. as câmeras gravam por cerca de 40 s.
- **Operação remota** pelo Telescience Support Center (NASA Glenn). Cada sessão queima de 4 a 10 gotas [20150023456 p.7-8].
- **Três câmeras** [20150023456 p.10]:
  - **HiBMs** (contraluz): mede o diâmetro da gota, 1024×1024 px, 30 fps, campo de ~30 mm;
  - **LLUV** (ultravioleta, filtro de 310 nm, emissão de OH*): mede a chama;
  - **colorida** (MDCA): mostra a chama visível.
- **Incertezas** [20150023456 p.14-15]:
  - gota: ±50 µm;
  - chama na LLUV: ±200 µm;
  - chama na câmera colorida: ±250 µm.
- A chama na câmera colorida mede cerca de 3/4 da medida na LLUV. O OH* tem pico fora da chama visível [20150023456 p.8, p.22].
- A atmosfera da câmara era **reaproveitada** entre testes. A composição real foi recalculada descontando o combustível vaporizado, o O₂ consumido e o CO₂ e a água produzidos [20150023456 p.13].
  - _Lição para o Tex:_ condição de teste é dado derivado, não leitura direta de sensor.

## 3. Faixas testadas

| Variável | Planejado (2009) | Realizado (TP 2015) |
|---|---|---|
| Combustíveis | metanol e heptano [20090014812 p.2] | metanol e n-heptano [20150023456 p.8] |
| Diâmetro inicial | 2 a 5 mm [20090014812 p.2] | 2 a 5 mm [20150023456 p.8] |
| O₂ (fração molar) | 0,10 a 0,50 [p.2], ou 0,1 a 0,4 no protocolo [p.3] | do ar até o LOI. Testes a 0,34 e 0,40 com O₂ alto [20150023456 p.17] |
| Pressão | 0,5 a 1,0 atm [p.2], ou 0,5 a 3,0 atm no protocolo [p.3] | 0,70 a 3,05 atm, a maioria entre 0,7 e 1 atm [20150023456 p.8] |
| Supressores/diluentes | CO₂ e hélio, de 0 a 0,70 [20090014812 p.2] | N₂, CO₂ e misturas. He no artigo de 2013 |
| Nº de testes | 196 pontos previstos [20090014812 p.3] | 284 testes documentados no TP [20150023456 p.7] |

**Divergências registradas:**
- O título do TP diz "March 2009 to December 2011", mas o texto e o Apêndice A falam em "March 2009 through December 2010" [20150023456 p.22, p.25].
- A ficha de 2009 traz faixas diferentes em parágrafos diferentes (O₂ e pressão). Vale o realizado.

## 4. Resultados principais (fatos)

- **LOI** (índice limite de oxigênio, abaixo do qual não há combustão):
  - do metanol com CO₂ e He: **~12 a 13% de O₂ em volume** [20130014061 p.1];
  - os valores observados ficaram um pouco **abaixo do esperado** [20150023456 p.8].
- **Dois modos de extinção** documentados [20150023456 p.8; 20130014061 p.8-9]:
  - **difusiva:** gotas menores e diluição menor; a chama encolhe até faltar tempo de residência;
  - **radiativa:** gotas maiores, O₂ mais baixo e diluição maior; a chama cresce e perde calor.
  - Também houve **extinção disruptiva** (a gota se fragmenta).
- **Metanol absorve água:** a água produzida na chama volta e se dissolve na gota. Quando a gota chega a ~30% de água, o fluxo de água se inverte e a chama apaga. A temperatura adiabática cai abaixo da faixa de extinção cinética, de **1200 a 1700 K** [20130014061 p.3].
- **Exemplos de testes** (artigo de 2013) [20130014061 p.5]:
  - Run #204: metanol, D₀ = 2,75 mm, ar a 1 atm. **Extinção com D = 1,10 mm.**
  - Run #110: D₀ = 2,83 mm, 21% O₂ e 30% CO₂, 0,7 atm. Extinção com 1,57 mm.
  - Run #263: D₀ = 2,67 mm, 21% O₂, 30% He e 49% N₂, 0,7 atm. Extinção com 1,42 mm. Queima mais rápida que com CO₂, porque o He conduz mais calor.
- **Lei do D²:** o quadrado do diâmetro cai linearmente com o tempo. A inclinação é a constante de queima K = −d(D²)/dt, em mm²/s. Fórmula clássica [20130014061 p.5]:
  - `Kcal = 8·λg/(ρl·cPg)·ln(1+B)`, onde B é o número de transferência;
  - no artigo, K foi ajustado só nos 80% centrais da vida da gota.
  - Gotas pequenas queimaram mais rápido que a teoria, efeito da condensação de água [20130014061 p.6].
- **Tabela IX do TP** traz, teste a teste [20150023456 p.26 em diante]:
  - pressão (mmHg);
  - frações de O₂, N₂, CO₂ e He;
  - D₀, diâmetro de extinção, K (mm²/s) e tempo de queima;
  - como o teste terminou: Extinction, Disruption ou Completion.
  - Ex.: FLEX-002, metanol, ar, 762 mmHg, D₀ = 1,86 mm, extinção com 0,94 mm, K = 0,6 mm²/s, 5 s.
  - **É o formato mais próximo de "measurements" do Tex.**
- **Contaminação das agulhas:** o revestimento das agulhas se dissolveu no combustível em parte dos testes [20150023456 p.22-23]. Segundo os autores:
  - K e o tamanho da chama foram pouco afetados;
  - a extinção disruptiva do metanol provavelmente veio do contaminante;
  - a extinção radiativa não foi afetada.
  - _Para o Tex:_ isso é exatamente o tipo de nota que vai em `quality_status` e `notes`.

## 5. Chamas frias (descoberta do FLEX)

- Depois que a chama quente (visível) do heptano apagava por radiação, a gota **continuava vaporizando** quase no mesmo ritmo. Em seguida parava num tamanho finito e formava uma "nuvem" ao redor [20150023100 p.12].
- Era uma **chama fria** sustentada (química de baixa temperatura), confirmada por modelos [20150023100 p.12].
  - Invisível às câmeras como configuradas: foi preciso reconfigurar a câmera OH* e fazer média de quadros [20150023100 p.15].
- Passou de **120 s** de queima fria [20150023100 p.17]. A razão chama/gota fica em ~3,1, de acordo com teoria e simulação [20150023100 p.19].
- Exemplo: n-decano, D₀ = 4,05 mm, 25% O₂, 75% N₂, 0,5 atm [20150023100 p.14].
- **Em aberto** (palavras dos autores) [20150023100 p.20]:
  - modelos cinéticos reduzidos não reproduzem bem a queima fria em pressões variadas;
  - misturas alcano-álcool mostram tendências contraintuitivas;
  - a reignição só aconteceu com gota na fibra.
- **Segurança:** uma chama "apagada" à vista pode continuar reagindo e gerando vapor de combustível.
  - _Hipótese Tex:_ um sensor só óptico pode dar falso "extinto" após a extinção radiativa de uma chama de líquido.

## 6. Limitações (dos autores)

- O TP **não interpreta** os dados. A intenção é só arquivá-los [20150023456 p.8, p.23].
- Gotas à deriva (g-jitter) saíram do campo da câmera e geraram lacunas na série [20150023456 p.22].
- Os radiômetros não foram sensíveis o bastante e não há dados de radiação [20150023456 p.10].
