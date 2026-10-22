# ACME: Advanced Combustion via Microgravity Experiments (chamas de gás)

Fontes:
- 20210022542: slides JASMAC-33, D. Stocker, out/2021.
- 20210015913: pôster PS-03403, só imagem, lido visualmente.
- 20220015583: pôster PS-03790, 2023, só imagem.

## 1. O que é

- **Seis investigações independentes** de chamas laminares não pré-misturadas de combustível gasoso, num só conjunto de hardware modular dentro do CIR [20210022542 p.2; 20210015913 p.1].
- **Por quê** [20220015583 p.1]:
  1. eficiência maior e menos poluição na combustão na Terra;
  2. prevenção de incêndio em espaçonaves.
- **Quando:**
  - operações na ISS de setembro de 2017 a fevereiro de 2022 [20220015583 p.1];
  - mais de 1.000 chamas acesas em 3,5 anos [20210015913 p.1].
- **Como:**
  - a tripulação monta o hardware;
  - os testes são comandados de NASA Glenn [20210022542 p.2];
  - câmara do CIR de ~100 L [20210022542 p.3];
  - inserto com queimador trocável, ignitor de fio quente, controladores de vazão, radiômetros, fotomultiplicadoras e fibras de SiC de 14 µm para pirometria de filamento (TFP) [20210022542 p.3, p.9, p.11].

## 2. As seis investigações e o que acharam (fatos)

### BRE (Burning Rate Emulator): a mais ligada à segurança da tripulação
Quintiere e Sunderland (U. Maryland), de Ris (FM Global). Simula a queima de um material sólido com um queimador de gás. Achados [20210022542 p.4]:
- **Perigo:** chamas de baixa velocidade podem queimar **por minutos** sem fluxo de ar e sem se espalhar.
- **Oxigênio:**
  - em O₂ elevado (como o previsto para naves futuras), as chamas duram minutos;
  - **abaixo de ~25% de O₂ (em volume) elas se autoextinguem.**
- **Tamanho:** chamas pequenas duram minutos em O₂ elevado. As grandes em geral se apagaram em até 1,5 min.
- **Combustível:** etileno em O₂ elevado queima por minutos. Metano se autoextinguiu em menos de 1 min.
- **Uso:** dar a condição de inflamabilidade em microgravidade e avaliar os métodos de teste de materiais de espaçonave.

### CLD Flame (Coflow Laminar Diffusion Flame)
Long e Smooke (Yale) [20210022542 p.5; 20210015913 p.1]:
- Chamas com fuligem em microgravidade são **mais altas e largas** e têm **5 a 8 vezes mais fuligem** que as equivalentes em 1 g.
- A microgravidade aumenta o limite de diluição do combustível (metano e etileno). Perto do limite as chamas são mais estáveis, o que permite chamas "levantadas" (*lifted*) com menos combustível.

### CFI-G (Cool Flames Investigation with Gases)
Sunderland, Axelbaum e Williams. Primeiras **chamas frias esféricas, quase estacionárias e apoiadas em queimador** [20210022542 p.6]:
- sequência: a chama quente apaga por radiação, vem um período escuro de ~1 s e surge uma chama fria bem menor;
- queimador poroso esférico de 6,35 mm;
- imagem com filtro para emissão de formaldeído.

### E-FIELD Flames
Dunn-Rankin e Chien (UC Irvine). Campo elétrico em chamas [20210022542 p.7; 20210015913 p.1]:
- há correlação clara entre luminosidade, intensidade da combustão e corrente iônica;
- chamas muito diluídas podem ser estabilizadas com campos muito fracos;
- em microgravidade há um pico de corrente iônica que coincide com a chama mais compacta;
- jatos sob campo forte ficaram instáveis, com corona e depois arco.

### Flame Design
Axelbaum e Sunderland. Formação e controle de fuligem [20210022542 p.8]:
- o tamanho da chama cresce com a vazão de reagente e **diminui com mais O₂ ambiente**;
- **chamas grandes crescem com o tempo até apagar por perda radiativa**; antes disso oscilam (apagam em parte e se refazem), com amplitude crescente;
- chamas muito pequenas têm pouca perda radiativa e tendem ao regime estacionário.

### s-Flame (Structure and Response of Spherical Diffusion Flames)
Law (Princeton) e Tse (Rutgers) [20210022542 p.9]:
- parecem ter sido observadas extinção radiativa (com vazão alta) e extinção cinética (com vazão baixa, porque a chama fica perto do queimador, onde a velocidade é maior);
- com diluição em hélio, os limites mudam.

## 3. O que levar para o Tex

**Fatos:**
- Chamas de gás em microgravidade **não se apagam sozinhas** em O₂ elevado e podem durar minutos sem ventilação (BRE).
- Mais O₂ = mais risco. O limite de ~25% observado no BRE é **específico daquelas condições** (queimador, combustível, tamanho). Não é uma regra geral de segurança.
- Microgravidade = **mais fuligem** (CLD), o que importa para a detecção por fumaça e a toxicidade.

**Hipóteses** (sem validação experimental nossa):
- _Hipótese:_ a duração da queima e a autoextinção dependem do O₂, do combustível e do tamanho. Uma regra de alerta do Tex poderia usar essas três variáveis, mas os limiares teriam de vir de dados do PSI, nunca desses resumos.
- _Hipótese:_ a oscilação antes da extinção (Flame Design) e a de 1,1 Hz em sólidos (`bass.md`) sugerem que um sinal de radiômetro poderia indicar chama perto de apagar. Não está testado para incêndio real.

## 4. Limitações

- Os slides e pôsteres trazem **achados qualitativos**, sem tabelas de valores.
- Os números (fuligem, temperaturas, correntes) ficam nos artigos de cada investigador e no PSI [20210015913 p.1].
- Na data do documento de 2021, os testes de 4 dos 6 estudos estavam concluídos e o 5º quase [20210022542 p.2].
