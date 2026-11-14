// Mapa de colunas de cada tabela experimental do PSI (conferido CSV a CSV em 14/11).
// Nomes de coluna = cabeçalho da fonte com espaços normalizados (normalizeHeader).
// Coluna que muda de nome faz a normalização recusar o arquivo, em vez de gravar errado.
// Detalhes das tabelas em docs/conhecimento/psi.md.
import type { ColumnSpec, TableMapping } from './psi-normalize.ts'

// O₂ abaixo de 10% depois de um teste em ar é implausível (ex.: BASS-II B2, 22,2% -> 1,6%)
const O2_PERCENT_RANGE = [10, 100] as const

const SAFFIRE_SAMPLE: readonly ColumnSpec[] = [
  { column: 'Ignition Power (W)', variable: 'ignition_power', unit: 'W' },
  { column: 'Ignition Time (s)', variable: 'ignition_time', unit: 's' },
  { column: 'Burn Time (s)', variable: 'burn_time', unit: 's' },
]

const FLAMES_IGNITED = (column: string): ColumnSpec => ({ column, variable: 'flames_ignited', unit: 'count' })

export const PSI_TABLES: Readonly<Record<string, TableMapping>> = {
  // ---- FLEX / FLEX-2 / CFI (gotas, CIR + MDCA) ----
  'PSI-69/PSI-69_Experimental table_FLEX.csv': {
    testLabel: 'FLEX Identifier',
    date: { column: 'Test Date', format: 'mdy' },
    sample: 'Fuel',
    outcome: 'Test end',
    measurements: [
      { column: 'Ambient pressure; mmHg', variable: 'ambient_pressure', unit: 'mmHg' },
      // O subscrito se perdeu no arquivo: "O" = O₂ e "N" = N₂
      { column: 'O initial ambient composition; mole fraction', variable: 'o2_initial', unit: 'mole fraction' },
      { column: 'N initial ambient composition; mole fraction', variable: 'n2_initial', unit: 'mole fraction' },
      {
        column: 'CO initial ambient composition; mole fraction',
        variable: 'co2_initial',
        unit: 'mole fraction',
        review: 'hipótese: "CO" do cabeçalho é CO₂ sem o subscrito (o FLEX diluiu com CO₂ e He)',
      },
      { column: 'He initial ambient composition; mole fraction', variable: 'he_initial', unit: 'mole fraction' },
      { column: 'Droplet initial diameter; mm', variable: 'droplet_initial_diameter', unit: 'mm' },
      { column: 'Visible flame extinction diameter; mm', variable: 'flame_extinction_diameter', unit: 'mm' },
      {
        column: 'Burning rate; mm',
        variable: 'burning_rate',
        unit: 'mm',
        review: 'unidade do cabeçalho é "mm"; constante de queima de gota costuma ser mm²/s',
      },
      { column: 'Burn time; s', variable: 'burn_time', unit: 's' },
    ],
    conditions: {
      o2: { column: 'O initial ambient composition; mole fraction', scale: 'mole-fraction' },
      pressure: { column: 'Ambient pressure; mmHg', unit: 'mmHg' },
      diluent: {
        N2: 'N initial ambient composition; mole fraction',
        CO2: 'CO initial ambient composition; mole fraction',
        He: 'He initial ambient composition; mole fraction',
      },
    },
  },
  // Uma linha por combustível, com faixas e listas ("0.17; 0.21"): só o raw e a temperatura
  'PSI-68/PSI-68_Experimental table_Flex2.csv': {
    testLabel: 'Sample (Fuel Type)',
    sample: 'Sample (Fuel Type)',
    measurements: [{ column: 'Ambient Temperature (C)', variable: 'ambient_temperature', unit: '°C' }],
  },
  'PSI-39/PSI-39_Experimental table_CFI.csv': {
    testLabel: 'Flex Number',
    date: { column: 'Test Date', format: 'd-mon-yy' },
    sample: 'Fuel',
    measurements: [
      { column: 'Pressure', variable: 'ambient_pressure', unit: 'atm' },
      { column: 'Oxygen', variable: 'o2_initial', unit: 'mole fraction' },
      { column: 'Nitrogen', variable: 'n2_initial', unit: 'mole fraction' },
      { column: 'Helium', variable: 'he_initial', unit: 'mole fraction' },
    ],
    conditions: {
      o2: { column: 'Oxygen', scale: 'mole-fraction' },
      pressure: { column: 'Pressure', unit: 'atm' },
      diluent: { N2: 'Nitrogen', He: 'Helium' },
    },
  },

  // ---- BASS / BASS-II (sólidos, MSG) ----
  'PSI-25/PSI-25_Experimental table_BASS-II.csv': {
    testLabel: 'Test #',
    date: { column: 'Date', format: 'mdy' },
    sample: 'Fuel Sample Material',
    measurements: [
      { column: 'Calibrated initial O2 % by vol', variable: 'o2_initial', unit: '%', range: O2_PERCENT_RANGE },
      { column: 'Calibrated final O2 % by vol', variable: 'o2_final', unit: '%', range: O2_PERCENT_RANGE },
      { column: 'Initial CO2 % by vol', variable: 'co2_initial', unit: '%' },
      { column: 'Final CO2 % by vol', variable: 'co2_final', unit: '%' },
      { column: 'Initial CO (ppm)', variable: 'co_initial', unit: 'ppm' },
      { column: 'Final CO (ppm)', variable: 'co_final', unit: 'ppm' },
    ],
    conditions: { o2: { column: 'Calibrated initial O2 % by vol', scale: 'percent' } },
  },
  'PSI-26/PSI-26_Experimental table_BASS.csv': {
    testLabel: 'As Run Test #',
    date: { column: 'Date', format: 'mdy' },
    sample: 'Fuel Sample Material',
    measurements: [],
  },

  // ---- Saffire I a III (escala real, Cygnus) ----
  'PSI-98/PSI-98_Experimental table_SAFFIRE-1.csv': {
    testLabel: 'Sample Number',
    sample: 'Material',
    measurements: [
      { column: 'Sample Thickness (cm)', variable: 'sample_thickness', unit: 'cm' },
      { column: 'Sample Length (cm)', variable: 'sample_length', unit: 'cm' },
      { column: 'Sample Width (cm)', variable: 'sample_width', unit: 'cm' },
      { column: 'Air Flow (cm/s)', variable: 'air_flow_velocity', unit: 'cm/s' },
      { column: 'Percent O2', variable: 'o2_concentration', unit: '%' },
      ...SAFFIRE_SAMPLE,
    ],
    conditions: {
      o2: { column: 'Percent O2', scale: 'percent' },
      flow: { column: 'Air Flow (cm/s)', unit: 'cm/s' },
      flowDirection: 'Flow Direction',
    },
  },
  'PSI-99/PSI-99_Experimental table_SAFFIRE-2.csv': {
    testLabel: 'Sample Number',
    sample: 'Material',
    measurements: [
      // "Samle" é a grafia da fonte; unidade na célula ("0.27 mm")
      { column: 'Samle Thickness', variable: 'sample_thickness' },
      { column: 'Sample Length', variable: 'sample_length' },
      { column: 'Sample Width (cm)', variable: 'sample_width', unit: 'cm' },
      { column: 'Air Flow (cm/s)', variable: 'air_flow_velocity', unit: 'cm/s' },
      { column: 'Percent O2 (Note 1)', variable: 'o2_concentration', unit: '%' },
      ...SAFFIRE_SAMPLE,
      { column: '1-g Burn Length', variable: 'burn_length_1g' },
      { column: '1-g Spread Rate', variable: 'spread_rate_1g' },
    ],
    conditions: {
      o2: { column: 'Percent O2 (Note 1)', scale: 'percent' },
      flow: { column: 'Air Flow (cm/s)', unit: 'cm/s' },
      flowDirection: 'Flow Direction',
    },
  },
  'PSI-100/PSI-100_Experimental table_SAFFIRE-3.csv': {
    testLabel: 'Sample Number',
    sample: 'Material',
    measurements: [
      { column: 'Sample Thickness', variable: 'sample_thickness' },
      { column: 'Sample Length', variable: 'sample_length' },
      { column: 'Sample Width', variable: 'sample_width' },
      { column: 'Air Flow', variable: 'air_flow_velocity' },
    ],
    conditions: { flow: { column: 'Air Flow', unit: 'cm/s' }, flowDirection: 'Direction' },
  },

  // ---- SAME / SAME-R (detecção de fumaça) e DAFT ----
  'PSI-101/PSI-101_Experimental table_SAME-R.csv': {
    testLabel: 'SAME Test #',
    sample: 'Sample Type',
    measurements: [
      { column: 'Inlet velocity (cm/s)', variable: 'inlet_velocity', unit: 'cm/s' },
      { column: 'Rt/R0', variable: 'radius_ratio', unit: 'ratio' },
      { column: 'Duration (sec)', variable: 'duration', unit: 's' },
      { column: 'Primary aging time (sec)', variable: 'primary_aging_time', unit: 's' },
      { column: 'Primary mixing time (sec)', variable: 'primary_mixing_time', unit: 's' },
      { column: 'Net aging time (sec)', variable: 'net_aging_time', unit: 's' },
    ],
  },
  'PSI-102/PSI-102_Experimental table_SAME.csv': {
    testLabel: 'Sample #',
    sample: 'Sample Material',
    measurements: [
      { column: 'Air Flow (cm/s)', variable: 'air_flow_velocity', unit: 'cm/s' },
      { column: 'Weight loss rate (mg/min)', variable: 'weight_loss_rate', unit: 'mg/min' },
      { column: 'Aging Duration (minutes)', variable: 'aging_duration', unit: 'min' },
    ],
  },
  'PSI-47/PSI-47_Experimental table_DAFT.csv': {
    testLabel: 'Session Name',
    sample: 'Sample Material',
    measurements: [],
  },

  // ---- SPICE / SLICE (chamas de jato, MSG) ----
  'PSI-107/PSI-107_Experimental table_Spice.csv': {
    sample: 'Fuel',
    measurements: [
      { column: 'Nozzle (mm)', variable: 'nozzle_diameter', unit: 'mm' },
      { column: 'Fuel Rate (sccm)', variable: 'fuel_flow_rate', unit: 'sccm' },
      { column: 'Fuel Rate (mg/s)', variable: 'fuel_mass_flow', unit: 'mg/s' },
      { column: 'HC Fuel Rate (mg/s)', variable: 'hc_fuel_mass_flow', unit: 'mg/s' },
      { column: 'Air Rate (cm/s)', variable: 'air_flow_velocity', unit: 'cm/s' },
    ],
    conditions: { flow: { column: 'Air Rate (cm/s)', unit: 'cm/s' } },
  },
  'PSI-106/PSI-106_Experimental table_Slice.csv': {
    sample: 'Fuel Type',
    measurements: [],
  },

  // ---- STDCE-1 (convecção por tensão superficial; os dois arquivos diferem) ----
  'PSI-108/PSI-108_Experimental table_STDCE-1.csv': {
    testLabel: 'Test#',
    outcome: 'Results',
    measurements: [
      { column: 'Power (W)', variable: 'heating_power', unit: 'W' },
      { column: 'Laser Diameter (cm)', variable: 'laser_diameter', unit: 'cm' },
    ],
  },
  'PSI-108/PSI-108_Experimental table_STDCE-1(1).csv': {
    testLabel: 'Test',
    outcome: 'Results',
    measurements: [
      { column: 'Power (W)', variable: 'heating_power', unit: 'W' },
      { column: 'Laser Diameter (cm)', variable: 'laser_diameter', unit: 'cm' },
    ],
  },

  // ---- ACME Flame Design e CFI-G (chamas esféricas, normais e inversas) ----
  // Chama inversa: o O₂ sai do queimador e o ambiente é combustível, então XO2 não é
  // o O₂ ambiente e não vira condição de teste (só a pressão).
  'PSI-10/PSI-10_Experimental table_Flame Design_Inverse Flame.csv': {
    testLabel: 'Test',
    measurements: [
      { column: 'XO2', variable: 'burner_o2_mole_fraction', unit: 'mole fraction' },
      { column: 'mO2 (mg/s)', variable: 'o2_mass_flow', unit: 'mg/s' },
      { column: 'mN2 (mg/s)', variable: 'n2_mass_flow', unit: 'mg/s' },
      { column: 'mtot (mg/s)', variable: 'total_mass_flow', unit: 'mg/s' },
      { column: 'XC2H4 initial', variable: 'ambient_c2h4_initial', unit: 'mole fraction' },
      { column: 'XC2H4 final', variable: 'ambient_c2h4_final', unit: 'mole fraction' },
      { column: 'pinit (atm)', variable: 'pressure_initial', unit: 'atm' },
      { column: 'pfinal (atm)', variable: 'pressure_final', unit: 'atm' },
      { column: 'pmean (atm)', variable: 'pressure_mean', unit: 'atm' },
      { column: 'mean Zst', variable: 'stoichiometric_mixture_fraction', unit: 'ratio' },
      { column: 'Tad (K)', variable: 'adiabatic_flame_temperature', unit: 'K' },
    ],
    conditions: { pressure: { column: 'pmean (atm)', unit: 'atm' } },
  },
  'PSI-10/PSI-10_Experimental table_Flame Design_Normal Flame.csv': {
    testLabel: 'Test',
    sample: 'Fuel',
    measurements: [
      { column: 'Xfuel', variable: 'burner_fuel_mole_fraction', unit: 'mole fraction' },
      { column: 'mfuel (mg/s)', variable: 'fuel_mass_flow', unit: 'mg/s' },
      { column: 'mN2 (mg/s)', variable: 'n2_mass_flow', unit: 'mg/s' },
      { column: 'mtot (mg/s)', variable: 'total_mass_flow', unit: 'mg/s' },
      { column: 'XO2 (init)', variable: 'o2_initial', unit: 'mole fraction' },
      { column: 'XO2 (final)', variable: 'o2_final', unit: 'mole fraction' },
      { column: 'pinit (atm)', variable: 'pressure_initial', unit: 'atm' },
      { column: 'pfinal (atm)', variable: 'pressure_final', unit: 'atm' },
      { column: 'pmean (atm)', variable: 'pressure_mean', unit: 'atm' },
      { column: 'mean Zst', variable: 'stoichiometric_mixture_fraction', unit: 'ratio' },
      { column: 'Tad (K)', variable: 'adiabatic_flame_temperature', unit: 'K' },
    ],
    conditions: {
      o2: { column: 'XO2 (init)', scale: 'mole-fraction' },
      pressure: { column: 'pmean (atm)', unit: 'atm' },
    },
  },
  'PSI-159/PSI-159_Experimental table_CFI-G_Inverse Flames.csv': {
    testLabel: 'Test',
    sample: 'Fuel',
    outcome: 'Self -ext or flow term',
    measurements: [
      { column: 'Xf before test', variable: 'ambient_fuel_initial', unit: 'mole fraction' },
      { column: 'Xf after test', variable: 'ambient_fuel_final', unit: 'mole fraction' },
      { column: 'approx p (bar)', variable: 'pressure', unit: 'bar' },
      { column: 'XO2', variable: 'burner_o2_mole_fraction', unit: 'mole fraction' },
      { column: 'HC burnrate (mg/s)', variable: 'hc_burn_rate', unit: 'mg/s' },
      { column: 'O2 flow rate (mg/s)', variable: 'o2_mass_flow', unit: 'mg/s' },
      { column: 'Tad (K)', variable: 'adiabatic_flame_temperature', unit: 'K' },
      { column: 'Zst', variable: 'stoichiometric_mixture_fraction', unit: 'ratio' },
      { column: 'burn time (sec)', variable: 'burn_time', unit: 's' },
      { column: 'Peak burner Temp (C)', variable: 'peak_burner_temperature', unit: '°C' },
    ],
    conditions: { pressure: { column: 'approx p (bar)', unit: 'bar' } },
  },
  'PSI-159/PSI-159_Experimental table_CFI-G_Normal Flames.csv': {
    testLabel: 'Test',
    sample: 'Fuel',
    outcome: 'Self-ext or flow term',
    measurements: [
      { column: 'XO2 before test', variable: 'o2_initial', unit: 'mole fraction' },
      { column: 'XO2 after test', variable: 'o2_final', unit: 'mole fraction' },
      { column: 'approx p (bar)', variable: 'pressure', unit: 'bar' },
      { column: 'Xf', variable: 'burner_fuel_mole_fraction', unit: 'mole fraction' },
      { column: 'mHC (mg/s)', variable: 'hc_mass_flow', unit: 'mg/s' },
      { column: 'Tad (K)', variable: 'adiabatic_flame_temperature', unit: 'K' },
      { column: 'Zst', variable: 'stoichiometric_mixture_fraction', unit: 'ratio' },
      { column: 'burn time (sec)', variable: 'burn_time', unit: 's' },
      { column: 'Peak burner T (C )', variable: 'peak_burner_temperature', unit: '°C' },
    ],
    conditions: {
      o2: { column: 'XO2 before test', scale: 'mole-fraction' },
      pressure: { column: 'approx p (bar)', unit: 'bar' },
    },
  },

  // ---- ACME BRE, CLD Flame, E-FIELD Flames e s-Flame: um resumo por dia de teste ----
  'PSI-20/PSI-20_Experimental table_ACME BRE.csv': {
    sample: 'Fuel Bottle',
    measurements: [
      { column: 'Burner Size (mm)', variable: 'burner_size', unit: 'mm' },
      FLAMES_IGNITED('Flames Ignited'),
    ],
  },
  'PSI-21/PSI-21_Experimental table_CLD Flame.csv': {
    testLabel: 'Test Day',
    date: { column: 'Test Day', format: 'yyddd' },
    sample: 'Fuel Bottle',
    measurements: [
      { column: 'Fuel MFC', variable: 'fuel_mfc_max_flow', unit: 'slpm' },
      { column: 'N2 MFC', variable: 'n2_mfc_max_flow', unit: 'slpm' },
      FLAMES_IGNITED('Flames ignited'),
    ],
  },
  'PSI-22/PSI-22_Experimental table_ACME E-FIELD Flames.csv': {
    testLabel: 'Test Day',
    date: { column: 'Test Day', format: 'yyddd' },
    sample: 'Fuel Bottle',
    measurements: [FLAMES_IGNITED('Flames Ignited')],
  },
  'PSI-23/PSI-23_Experimental table_ACME s-Flame.csv': {
    testLabel: 'Test Day*',
    date: { column: 'Test Day*', format: 'yyddd' },
    sample: 'Fuel Bottle',
    measurements: [FLAMES_IGNITED('Flames Ignited*')],
  },
}

// Fora da normalização: não são tabelas de teste
export const PSI_TABLES_SKIPPED: Readonly<Record<string, string>> = {
  'PSI-142/PSI-142_Experimental table_Data Summary Table.csv': 'índice de figuras de artigos, não tabela de testes',
  'PSI-181/PSI-181_Experimental table_Experimental Table_PSI_181.csv': 'amostras de solda Pb-Sn, fora do tema',
}

export function tableKey(accession: string, fileName: string): string {
  return `${accession}/${fileName}`
}
