// Cenário ativo dos mocks MSW. Fica fora de handlers.ts para a tela poder
// trocar de cenário sem importar o MSW no bundle.
// Todos os cenários usam dados SINTÉTICOS (não são dados da NASA).

export const MOCK_SCENARIOS = {
  backend: 'Espelho do backend (valores fixos do main.rs)',
  simulacao: 'Simulação dinâmica (oscila como o laço do backend)',
  critico: 'Risco crítico com supressão ativa',
  offline: 'Backend fora do ar',
  lento: 'Backend lento (4 s por resposta)',
  'fora-do-contrato': 'Resposta fora do contrato',
} as const

export type MockScenario = keyof typeof MOCK_SCENARIOS

export const DEFAULT_SCENARIO: MockScenario = 'backend'

let active: MockScenario = DEFAULT_SCENARIO

export function isMockScenario(value: unknown): value is MockScenario {
  return typeof value === 'string' && value in MOCK_SCENARIOS
}

export function getMockScenario(): MockScenario {
  return active
}

export function setMockScenario(scenario: MockScenario): void {
  active = scenario
}
