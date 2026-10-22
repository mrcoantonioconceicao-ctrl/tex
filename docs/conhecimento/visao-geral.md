# Visão geral: fogo em microgravidade

## 1. A física, em uma página

**Fatos:**
- Na Terra, o gás quente sobe (empuxo) e puxa ar fresco por baixo. Isso alimenta a chama e dá a ela o formato de vela. Em microgravidade não existe esse empuxo, e o oxigênio chega à chama por **difusão** e por **ventilação forçada**.
  - Por isso uma gota em ar parado queima com simetria esférica [20150023456 p.8].
  - Na Terra, a convecção natural destrói essa simetria [20150023456 p.8].
- Vantagens das chamas em microgravidade para a ciência [20210022542 p.2]:
  - sem tremulação (*flicker*);
  - chamas esféricas;
  - escalas de comprimento grandes;
  - tempos de residência longos.
- **A ausência de gravidade não apaga o fogo.**
  - Chamas de baixa velocidade queimam por minutos sem fluxo de ar e sem se espalhar [20210022542 p.4].
  - Pequenas chamas em acrílico queimaram por mais de 5 minutos antes de se apagar sozinhas [20140011099 p.55].
- **Nem toda chama é esférica.**
  - Com ventilação, a chama se alonga a favor do vento (concorrente) ou avança contra ele (oposta).
  - Perto da extinção, a chama vira um hemisfério azul [20210011385 p.97].
- **O ar da ventilação decide tudo.** Para sólidos existe um mapa de inflamabilidade em forma de "U":
  - com fluxo de ar muito baixo, a chama apaga por falta de O₂ e perda de calor (*quenching*);
  - com fluxo muito alto, ela é soprada (*blowoff*);
  - o ponto mais perigoso (menor O₂ necessário) fica em velocidades da ordem das de difusão [20160000593 p.18; 20210011385 p.97].
- "É impossível eliminar todo o risco de incêndio numa espaçonave enquanto houver combustível, oxigênio e uma fonte de calor" [20150023100 p.24].
- Os modos de extinção vêm na seção 6.

## 2. Atmosferas de espaçonave

- **ISS (nominal):** ar a 1 atm, fração molar de O₂ 0,21 e de CO₂ 0,005 [20150023456 p.15].
- **Atmosferas de exploração** estudadas pela NASA: 52,7 a 58,6 kPa com 27,6 a 34% de O₂ [20150023100 p.24]. É pressão menor com mais oxigênio, o que aumenta a inflamabilidade (ver Saffire VI e BRE/ACME).
- **Pré-respiração de EVA:** ambiente com O₂ mais alto, também usado no FLEX [20150023456 p.19].

## 3. Instalações

| Instalação | O que é | Onde aparece |
|---|---|---|
| **CIR** (Combustion Integrated Rack) | Rack de combustão da ISS, no módulo Destiny (EUA). Lançado em 2008, em testes desde 2009 [20250002347 p.1]. Câmara de ~90 L, de 0 a 9 atm [20150023456 p.8]. O FLEX limitou a ~3 atm por segurança [20150023456 p.9]. O FOMA prepara a mistura de gases | FLEX, ACME, SoFIE |
| **MDCA** | Aparelho de gotas dentro do CIR: agulhas opostas formam a gota e fios quentes a acendem | FLEX |
| **Inserto ACME** | Queimador trocável, ignitor, controladores de vazão, radiômetros, fibras de pirometria | ACME |
| **MSG** (Microgravity Science Glovebox) | Caixa de luvas com volume de trabalho de 0,25 m³ e filtros que convertem CO em CO₂ [20210011385 p.10-11] | BASS, BASS-II |
| **Cygnus** | Nave de carga, usada depois de desacoplar da ISS, sem tripulação | Saffire I a VI |
| **Torre de queda GRC Zero-g** | 5,18 s de microgravidade, 132 m de queda, <0,00001 g, US$ 5,8 mil por queda [20150023100 p.30] | validação em solo |

Linha do tempo do CIR [20250002347 p.1]:
- **Gotas (2009 a 2017):** 5 investigações no MDCA. Descoberta das **chamas frias não pré-misturadas**.
- **Gases (2017 a 2022):** 6 estudos com o ACME, com 4 tipos de queimador.
- **Sólidos (2023 em diante):** 6 experimentos planejados no SoFIE, com fluxo de oxidante e amostras de acrílico.

O pôster cita 17 experimentos no CIR [20250002347 p.1].

## 4. O programa da NASA

- De 1989 a 2006 houve um programa grande de base. A partir de 2006 o foco mudou para "exploração": segurança contra incêndio em espaçonaves e ISRU [20150023100 p.4].
- Investigações por tipo de combustível [20150023100 p.6-9]:
  - **sólidos:** BASS, SoFIE, FLARE (JAXA);
  - **gotas:** FLEX, FLEX-2, chamas frias;
  - **gases:** SPICE, SLICE, ACME;
  - **detecção de fumaça:** SAME;
  - **água supercrítica:** SCWM.
- Perguntas centrais do Saffire [20180005168 p.3]: "o que mata primeiro? Acúmulo de CO? Outros tóxicos? Calor? Fumaça? Aumento de pressão? Como a tripulação deve reagir?". A resposta do Saffire VI é: **fumaça e gases (CO, CO₂), não o calor** (ver `saffire.md`).

## 5. Onde estão os dados brutos

- **PSI** (psi.nasa.gov): os dados de todas as ciências físicas da NASA estão sendo carregados lá, abertos a todos [20150023100 p.35].
  - Os resultados e dados brutos do FLEX estão no PSI, com cadastro obrigatório [20150023456 p.22].
  - Os dados do ACME são liberados aos poucos no PSI [20210015913 p.1].
- Formato dos dados do FLEX entregues ao time de ciência [20150023456 p.13]:
  - imagens TIFF de 12 bits (câmeras HiBMs e LLUV) e BMP (câmera colorida);
  - arquivos de texto com ajustes das câmeras, pressão e temperatura da câmara, radiômetro e comentários de anomalias;
  - um índice de cada imagem com o horário de aquisição.
- **Pendência:** ainda falta checar à mão o portal PSI (login, formatos, quais investigações existem). Ver `docs/estudo-de-fontes.md`.

## 6. Mecanismos de extinção

| Mecanismo | Quando acontece | Exemplo |
|---|---|---|
| **Difusiva** (tempo de residência curto) | A chama fica perto demais da gota ou superfície e o gás passa rápido demais para reagir | Gotas pequenas de metanol [20130014061 p.8-9] |
| **Radiativa** (perda de calor) | A chama grande perde calor por radiação até esfriar | Gotas grandes, O₂ baixo [20130014061 p.9]. Chamas grandes do Flame Design [20210022542 p.8] |
| **Quenching** em fluxo baixo | Pouco O₂ chega e as perdas dominam | BASS: 1 a 5 cm/s [20210011385 p.108] |
| **Blowoff** em fluxo alto | O ar arrasta o gás combustível para fora da zona quente | BASS-II: buraco na frente da chama na região de estagnação [20210011385 p.97] |
| **Diluição/supressão** | Inertes (N₂, CO₂, He) reduzem o O₂ disponível | FLEX: LOI do metanol de ~12 a 13% de O₂ [20130014061 p.1] |
