# BASS e BASS-II: Burning and Suppression of Solids (materiais sólidos)

Fontes:
- 20140011099: slides do BASS, 2013.
- 20160000593: pôster do BASS-II, 2014.
- 20210011385: NASA/TM-20210011385, relatório final do BASS-II, 2021, 144 p.

## 1. O que é

- Um **túnel de vento pequeno** (duto de 7,6×7,6×17 cm) dentro da **MSG** (caixa de luvas da ISS) [20210011385 p.12].
  - Um ventilador impõe o fluxo de ar: até ~55 cm/s sem restritores, ou ~35 cm/s com dois [20210011385 p.12].
  - Os slides do BASS (2013) falam em até 40 cm/s [20140011099 p.2].
- **Operação "lab partner":** o astronauta controla ignição e fluxo enquanto a equipe acompanha de terra [20210011385 p.9; 20160000593 p.3].
- **Amostras:**
  - PMMA (acrílico) em bastões de 6,35 a 12,7 mm, placas de 0,125 a 5 mm e calotas esféricas;
  - tecido SIBAL (algodão e fibra de vidro) [20210011385 p.13].
  - No BASS-I também houve Ultem, Nomex e velas [20140011099 p.24].
- **Tamanho:**
  - BASS: 41 amostras e 115 queimas [20140011099 p.8];
  - BASS-II: **126 testes**, acima dos 103 planejados [20210011385 p.11].
- **Inovação do BASS-II:** reduzir o O₂ da MSG com N₂ da própria ISS, de ~21% até ~14% [20210011385 p.11, p.14]. A diluição foi calculada com um modelo de reator perfeitamente misturado (CSTR) e levava de 1 a 3 h [20210011385 p.14].
- **Sensores de bordo** (antes e depois de cada teste) [20210011385 p.14]:
  - CSA-CP: O₂ com resolução de 0,1%, CO de 0 a 1.000 ppm;
  - CDM: CO₂ de 0 a 5%.

## 2. A hipótese que o BASS-II testou

> "Materiais em microgravidade, **com ventilação adequada**, queimam tão bem ou melhor que o mesmo material em gravidade normal, com as outras condições iguais" [20210011385 p.11; 20160000593 p.6].

- A NASA qualifica materiais com o **teste de queima para cima em 1 g** (NASA-STD-6001 Test 1), considerado o pior caso na Terra. **Pode não ser conservador para o espaço** [20210011385 p.11].
- Para o National Research Council (Decadal Survey), os testes atuais em 1 g "não são adequados para cenários de gravidade reduzida" [20160000593 p.4].

## 3. Resultados principais (fatos)

### O fluxo de ar manda
- As chamas em microgravidade são **muito sensíveis a fluxos de 0 a 5 cm/s** [20140011099 p.54]:
  - **abaixo de 1 cm/s:** a chama fica azul, fraca e muito estável. Como perde pouco calor, **queima por muito tempo**;
  - **entre 1 e 5 cm/s:** a chama aquece o sólido continuamente e fica mais forte com o tempo.
- A chama responde **quase sem atraso** à mudança de fluxo, porque o gás é muito mais rápido que o sólido [20140011099 p.54].
- **Concorrente × oposta** a ~10 cm/s: 2,55 mm/s contra 1,21 mm/s [20140011099 p.20].
  - Concorrente: a velocidade cresce linearmente com o fluxo, e há extinção por *quenching* perto de 1 cm/s.
  - Oposta: a velocidade é máxima num fluxo intermediário [20140011099 p.22].
- A chama apagou quando o fluxo foi cortado. Um **jato de N₂ não conseguiu apagar** a chama sobre o sólido quente: **sólidos grossos guardam muito calor** [20140011099 p.55].
- Pequenas chamas em placas de acrílico queimaram **mais de 5 minutos** antes de se apagar sozinhas [20140011099 p.55].
  - Os autores alertam: uma chama minúscula pode passar despercebida e crescer se a ventilação aumentar ou se ela alcançar outro combustível.

### Mapa de inflamabilidade em "U" (PMMA em bastões, Olson)
- O O₂ variou de 13,6 a 22,2% e o fluxo de 0 a 55 cm/s [20210011385 p.72].
- **Ramo de quenching** (fluxo baixo): perto de apagar, a chama vira um hemisfério azul e **oscila a ~1,1 Hz** [20210011385 p.80, p.97].
- **Ramo de blowoff** (fluxo alto): abre-se um buraco na chama na região de estagnação. Os limites batem com os da torre de queda de 5,18 s [20210011385 p.97].
- **O mínimo do "U"** (o pior caso) fica em velocidades da ordem das de difusão [20160000593 p.18; 20210011385 p.97].
- **Comparação com 1 g:**
  - o blowoff em 1 g do bastão de ¼" ocorre com 16% de O₂;
  - no BASS-II houve **espalhamento estável com 13,6% de O₂**;
  - logo, a "margem de segurança de oxigênio" é **negativa em 2,4 pontos**, e os limites de 1 g deveriam ser rebaixados ao menos isso [20160000593 p.18].
  - O limite de 1 g para queima para cima, de 15,4% de O₂, aparece para comparação no relatório [20210011385 p.97].
- O **atraso de ignição** cresce muito perto do limite e pode ser quase **10 vezes** o tempo de ignitor ligado do NASA-STD-6001 [20210011385 p.97].
- **Perto do limite a chama fica rica em combustível:** escapa pirolisado e o CO cresce [20210011385 p.97].

### Velocidade crítica de extinção radiativa (Bhattacharjee, PMMA fino)
- Velocidade de extinção [20210011385 p.21]:
  - ~1 cm/s para espessuras de 100, 200 e 300 µm;
  - ~1,5 cm/s para 400 µm.
- Experimento a 1 atm [20210011385 p.36]:
  - **10 ± 5 mm/s com 21% de O₂**;
  - **30 ± 5 mm/s com 16%**.
  - Conclusão: a espessura não muda a velocidade crítica, e **menos O₂ exige mais fluxo** para a chama sobreviver.
- Blowoff acima de ~40 cm/s em amostra de 0,1 mm [20160000593 p.13].

### Tecido SIBAL em fluxo concorrente (T'ien)
- Amostras de 1,2 e 2,2 cm de largura e 10 cm de comprimento, O₂ de 21 a 16%, fluxo de 40 a 1 cm/s [20210011385 p.101].
- **Quenching entre 1 e 5 cm/s**, em velocidade maior quando há menos O₂. Foi a primeira determinação limpa desse limite em espalhamento concorrente [20210011385 p.101, p.108].
- A chama apaga de forma tridimensional: encolhe no comprimento e na largura [20210011385 p.108].

### Materiais de nave
- No BASS (2013), **Ultem e Nomex HT90-40 não queimaram** com 21 a 22% de O₂ e ~15 cm/s, como em 1 g. O **Nomex-III queimou** com 22% de O₂ e 14 cm/s [20140011099 p.24, p.26].
- No BASS-II, **as 3 amostras de Nomex não acenderam**, "excelente resultado para a segurança da ISS", onde o Nomex é barreira contra fogo [20210011385 p.54].
- **Vela de cera:** gotas de cera em chamas foram ejetadas. Plásticos que derretem podem lançar gotas acesas e incendiar outros materiais [20210011385 p.54].

### Produtos de combustão (primeiro conjunto extenso em microgravidade)
- O consumo de O₂ e a produção de CO₂ seguem a estequiometria do PMMA (C₅H₈O₂ + 6 O₂ → 5 CO₂ + 4 H₂O) [20210011385 p.14-15].
- **CO por 1% de CO₂** [20210011385 p.15]:
  - ~550 ppm em bastões com fluxo concorrente;
  - ~370 ppm em placas grossas com fluxo oposto.
- **A razão CO/CO₂ ficou muito acima de 0,004**, o valor típico de uma queima eficiente em caldeira. Ou seja, as chamas em microgravidade são **ineficientes** [20210011385 p.16].
- Na estação Mir, um leito de carvão em combustão lenta no sistema de controle de contaminantes elevou muito o CO antes de ser detectado [20210011385 p.16].
- **HRR em geral bem abaixo de 100 W** (pelo método de Huggett). A razão de equivalência global foi de **1,3** em média, ou seja, chamas ricas e mal ventiladas [20210011385 p.10, p.19].
- Um fogo desse tamanho diluído no laboratório americano da ISS (106 m³) daria só **~1,5 ppm de CO** [20210011385 p.16].

## 4. Para o Tex

**Fatos úteis:**
- A **ventilação é a variável de controle** do incêndio. Desligar o ar pode apagar uma chama pequena, mas:
  - sólidos quentes resistem ao jato de N₂;
  - o fluxo bem baixo é justamente a região mais perigosa do mapa em "U".
- Os limites de inflamabilidade de 1 g **não são conservadores** para o PMMA em microgravidade.

**Hipóteses** (não validadas por nós):
- _Hipótese:_ desligar a ventilação ao detectar fogo (procedimento comum em naves) pode ajudar ou atrapalhar, conforme a posição no mapa em "U" e o estado térmico do material. Uma tela que só diga "desligue a ventilação" simplifica demais.
- _Hipótese:_ a oscilação de ~1,1 Hz antes do quenching poderia ser um indicador de chama perto de apagar num sensor radiométrico.

## 5. Divergências entre as fontes

| Item | Fonte A | Fonte B |
|---|---|---|
| Fluxo máximo do duto | até 40 cm/s [20140011099 p.2; 20160000593 p.3] | 0 a 55 cm/s [20160000593 p.7; 20210011385 p.12] |
| **SMAC de CO por 1 h** | **55 ppm**, e 10 ppm para exposição longa [20210011385 p.16] | **425 ppm**, e 100 ppm por 24 h [20240002981 p.5, citando JSC 20584 Rev. A, 2020] |

O SMAC de CO diverge muito entre as duas fontes, provavelmente por revisões diferentes da norma. **Antes de usar qualquer limiar no Tex, ler a norma vigente (JSC 20584) e citar a revisão.**
