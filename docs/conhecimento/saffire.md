# Saffire: Spacecraft Fire Safety Demonstration (incêndio em escala real)

Fontes:
- 20170001636: artigo de objetivos e desenvolvimento, escrito antes do voo do Saffire-I (2016).
- 20180005168: slides ASGSR 2017, com resultados do I ao III.
- 20240002981: ICES-2024-365, resultados preliminares do Saffire VI.

**É o programa mais próximo do cenário do Tex** (incêndio num habitat fechado).

## 1. Por que existe

- Todo tipo de estrutura habitada na Terra (avião, navio, prédio, mina) já passou por testes de incêndio em escala real. Antes do Saffire, nenhum experimento em microgravidade tinha usado amostras maiores que **~10 cm** [20170001636 p.1], ou 8×15 cm nos slides [20180005168 p.11].
- Sem dados de escala real, o projeto de segurança das naves se apoiava em padrões e testes **terrestres** (1 g) [20170001636 p.1; 20240002981 p.1].
- A solução foi queimar em uma **Cygnus** (nave de carga), depois de desacoplada da ISS e antes da reentrada, **sem tripulação** [20170001636 p.1].
  - O teste é automático. Os dados descem antes da reentrada destrutiva.
- **Risco de segurança principal:** acionar o ignitor sem querer com a Cygnus ainda acoplada, o que exporia a tripulação a gases tóxicos.
  - Foi controlado com 4 relés de trava comandados pela Cygnus e comando de solo obrigatório [20170001636 p.4].

## 2. Saffire I, II e III (2016 a 2017)

**Hardware:**
- módulo de ~53×90×133 cm, com um duto de fluxo e uma baia de aviônica;
- ventiladores puxam ar por um duto com retificador de fluxo [20170001636 p.2].
- Diagnóstico [20170001636 p.2]:
  - duas câmeras (dado primário);
  - termopares no fluxo, na amostra e na pluma;
  - radiômetros;
  - sensores de O₂ e CO₂, pressão e anemômetros.

**Amostras:**
- **Tecido SIBAL**: 75% algodão e 25% fibra de vidro, ~18 mg/cm². Queima como algodão e mantém a forma [20170001636 p.2; 20180005168 p.25].
- Saffire I e III usaram uma amostra grande de **0,94 m × 0,40 m** [20170001636 p.2].
- Saffire II usou 9 amostras de 5×29 cm [20170001636 p.2]:
  - silicones de várias espessuras, SIBAL, PMMA e Nomex;
  - foram escolhidas por terem limite de O₂ em 1 g logo acima e logo abaixo de 21%.

**Resultados** (Tabela 1 dos slides) [20180005168 p.30-31]:

| Amostra | Material | Fluxo | Direção | Queima em µg | Velocidade de espalhamento em µg | Em 1 g |
|---|---|---|---|---|---|---|
| I-1 | SIBAL 40,6×94 cm | 20 cm/s | concorrente | 420 s, ~84 cm | **1,8 mm/s** | completa, aceleratória |
| I-2 | SIBAL | 20 cm/s | oposta | 70 s, ~10 cm | 1,3 mm/s | ~0 |
| II-1 a II-4 | silicone (0,27 a 1,03 mm) | 20 cm/s | conc./oposta | **insignificante** | n/a | algumas queimaram por completo |
| II-5 | SIBAL 5 cm | 20 cm/s | concorrente | 145 s, 29 cm | 2,1 mm/s | completa |
| II-6 | SIBAL 5 cm | 25 cm/s | concorrente | 115 s, 29 cm | 2,6 mm/s | completa |
| II-7 | PMMA + Nomex | 20 cm/s | concorrente | o Nomex não queimou | n/a | n/a |
| III-1 | SIBAL 40,6×94 cm | 25 cm/s | concorrente | 300 s, ~84 cm | **2,3 mm/s** | completa, aceleratória |
| III-2 | SIBAL | 25 cm/s | oposta | 60 s, ~10 cm | 0,98 mm/s | ~0 |

O O₂ ambiente na Cygnus ficou entre ~21,0 e 22,1% durante esses testes [20180005168 p.30].

**Conclusões dos autores** [20180005168 p.16, p.18, p.23]:
- Em microgravidade, a chama concorrente sobre material fino carbonizante **chegou a velocidade constante** de espalhamento. Em 1 g o mesmo material acelera.
- A velocidade da chama é proporcional à velocidade do ar.
- O espalhamento concorrente foi **mais sensível ao tamanho do duto** do que se esperava.
- A potência média da chama no Saffire-I foi de **1200 ± 300 W**.
- Dá para fazer testes grandes com segurança numa nave sem tripulação.

**Leitura cuidadosa** (fato da tabela, sem extrapolar): nos silicones do Saffire-II, a queima em microgravidade foi insignificante a ~22% de O₂, enquanto parte das mesmas amostras queimou em 1 g.
- Ou seja: "**microgravidade é sempre mais inflamável**" **não é verdade como regra geral**. Depende do material e do fluxo.
- Compare com o BASS-II (`bass.md`), onde o PMMA queimou em microgravidade com menos O₂ que em 1 g.

## 3. Saffire IV, V e VI (até 2024)

**Objetivos novos** [20180005168 p.19; 20170001636 p.5]:
- monitoramento e limpeza pós-incêndio (*smoke eater*);
- crescimento do fogo em atmosfera com **mais O₂ e menos pressão**;
- dados para validar modelos do impacto na habitabilidade;
- detecção com sensores de múltiplos momentos (para rejeitar alarme falso);
- supressão com névoa de água.

**Hardware novo:**
- câmeras laterais;
- sensores de gás na entrada e na saída, para calorimetria por consumo de O₂;
- 6 sensores remotos de temperatura e CO₂ espalhados pela Cygnus;
- Far Field Diagnostics (FFD), perto da escotilha, com fumaça, gases e limpeza [20240002981 p.2].
- A meia altura do duto caiu de 25 para 15 cm (a largura de 45 cm foi mantida) [20240002981 p.2].
- No IV e no V o sensor de saída ficou mal posicionado e os dados de gás não serviram. No VI ele foi corrigido [20240002981 p.2].

**Volume livre:** de 17 a 19 m³ [20240002981 p.2].

**Procedimento** [20240002981 p.3]:
1. medir o volume com uma liberação conhecida de CO₂;
2. ventilar até a pressão-alvo;
3. completar com O₂.

**Condições** (Tabela 1) [20240002981 p.3]:

| Teste | Material | Pressão | O₂ | Volume livre |
|---|---|---|---|---|
| IV-1 | SIBAL, 50 cm | 100,0 kPa | 22,0% | 17,9 m³ |
| V-2 | malha de algodão, 50 cm | 70,7 kPa | 26,2% | 19,0 m³ |
| VI-2 | SIBAL, 50 cm | 54,1 kPa | 31,0% | 16,7 m³ |
| VI-3 | PMMA 2 lados (1 cm), 18 cm | 54,6 kPa | 30,3% | 16,7 m³ |
| VI-4 | PMMA 1 lado (0,5 cm), 18 cm | 55,2 kPa | 28,8% | 16,7 m³ |

Todas com fluxo concorrente de 20 cm/s. O Nomex do VI **não acendeu** [20240002981 p.4].

**Resultados** (Tabela 2) [20240002981 p.6]. Legenda: "O₂" = calorimetria por consumo de oxigênio; "comb." = calorimetria por consumo de combustível; campos vazios na fonte = "n/d".

| Teste | Queima (s) | Pico HRR, O₂ (W) | Calor total, O₂ (kJ) | HRR médio / total, comb. | T máx. na saída do duto (°C) | T máx. perto do FFD (°C) | ΔCO₂ (ppm) | ΔpCO₂ (mmHg) | ΔCO (ppm) |
|---|---|---|---|---|---|---|---|---|---|
| IV-1 SIBAL | 130 | n/d | n/d | 3.150 W / 409 kJ | 45 | 25 | 1.390 | 1,03 | 80 |
| V-2 algodão | 200 | n/d | n/d | 2.800 W / 560 kJ | 46 | 23 | 2.360 | 1,26 | 83 |
| VI-2 SIBAL | 112 | 3.217 | 580 | 3.650 W / 409 kJ | 48 | 20 | 2.800 | 1,15 | 120 |
| VI-3 PMMA 2 lados | 780 | 3.080 | 1.280 | n/d | 77 | 21 | 8.539 | **3,51** | **308** |
| VI-4 PMMA 1 lado | 1.200 | 1.507 | 830 | n/d | 57 | 21 | 8.117 | **3,37** | **320** |

HRR = taxa de liberação de calor, estimada pelo **método de Huggett: 13,1 kJ por grama de O₂ consumido** [20240002981 p.4]. No SIBAL, os dois métodos concordaram dentro de 15% [20240002981 p.4]. Em materiais grossos (PMMA) não dá para estimar pelo combustível, porque a queima na superfície não aparece nas câmeras.

## 4. A conclusão que importa para o Tex

Fatos [20240002981 p.5-6]:
- Fogos de **1,5 a 3,2 kW** (pequenos para padrões terrestres) em 17 a 19 m³ só aqueceram muito **perto do próprio fogo**. Perto do FFD a temperatura quase não mudou.
- O **CO e o CO₂ subiram muito**:
  - nos dois testes de PMMA, o CO₂ passou o limite de 1 h (média de pCO₂ ≤ 3 mmHg, NASA-STD-3001);
  - o CO ficou bem acima do SMAC de 24 h (**100 ppm**) e perto do SMAC de 1 h (**425 ppm**).
- Um detector de fumaça por ionização, com limiar de 1 mg/m³, só disparou aos **981 s**. A essa altura **a maior parte dos gases perigosos já tinha sido liberada**.
- Em resumo, nas palavras dos autores: o risco humano de um incêndio na nave se parece com o de incêndios terrestres. **O principal perigo não é o calor, e sim a fumaça e os gases.**
- Falta estender esses resultados para gravidade parcial (Lua e Marte) [20240002981 p.6].

Hipóteses e decisões para o Tex (não validadas):
- _Hipótese:_ um painel que só monitora temperatura subestima o risco. CO, CO₂ e fumaça deveriam ter peso maior que a temperatura nos alertas.
- _Hipótese:_ um detector de fumaça com limiar fixo atrasa o alerta. Combinar sensores de gás pode antecipar a detecção, como sugerem os objetivos do Saffire IV a VI (multissensor). Precisa de validação com dados reais.
- _Decisão a discutir:_ usar os SMAC (CO: 425 ppm por 1 h, 100 ppm por 24 h) como limiares de referência na tela, **citando a fonte** e deixando claro que a leitura exibida é simulada.

## 5. Divergências entre as fontes

| Item | Fonte A | Fonte B |
|---|---|---|
| Fluxo do Saffire-III | 30 cm/s, planejado [20170001636 p.2] | **25 cm/s**, realizado [20180005168 p.16, p.30] |
| Tempo de queima do Saffire-I | 400 s [20180005168 p.16] | 420 s [20180005168 p.25, p.31] |
| Data de operação do Saffire-I | 2 jun 2016, previsto [20170001636 p.4] | 14 jun 2016 [20180005168 p.15] |
| Potência de ignição do Saffire-I | 165 W por 8 s [20180005168 p.23] | 182 W por 8 s [20180005168 p.31] |
| Faixa de potência dos fogos IV a VI | "1,5 a 3,2 kW" [20240002981 p.2, p.6] | média de 3.650 W por consumo de combustível no VI-2 [20240002981 p.6] |
| `docs/estudo-de-fontes.md` | cita "até cerca de 10 kW" | nenhum dos 14 documentos traz esse número. **Achar a fonte ou corrigir** |
