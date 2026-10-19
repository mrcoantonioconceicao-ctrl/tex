import { describe, expect, it } from 'vitest'
import {
  appendReading,
  chartDomain,
  connectionStatus,
  describeRisk,
  formatAge,
  formatNumber,
  secondsSince,
  toReading,
  type Reading,
} from './model'

function reading(at: number, overrides: Partial<Reading> = {}): Reading {
  return { at, experimentId: 'SINTETICO-A', temperature: 850, oxygen: 21, flameSpread: 1, ...overrides }
}

describe('describeRisk', () => {
  it('classifica os níveis conhecidos do backend', () => {
    expect(describeRisk('MODERATE_WARNING').tone).toBe('warning')
    expect(describeRisk('CRITICAL_SUPPRESSION_ACTIVE').tone).toBe('critical')
  })

  it('não quebra com nível desconhecido e mostra o código recebido', () => {
    const risk = describeRisk('NOVO_NIVEL')
    expect(risk.tone).toBe('unknown')
    expect(risk.description).toContain('NOVO_NIVEL')
  })
})

describe('connectionStatus', () => {
  const base = { hasData: true, isError: false, updatedAt: 10_000, now: 10_000, pollMs: 2000 }

  it('fica "connecting" enquanto não há dado nem erro', () => {
    expect(connectionStatus({ ...base, hasData: false })).toBe('connecting')
  })

  it('fica "live" logo após uma atualização', () => {
    expect(connectionStatus({ ...base, now: 12_000 })).toBe('live')
  })

  it('fica "stale" quando passa de 3 ciclos sem atualizar', () => {
    expect(connectionStatus({ ...base, now: 16_000 })).toBe('live')
    expect(connectionStatus({ ...base, now: 16_001 })).toBe('stale')
  })

  it('erro tem prioridade, com ou sem dado anterior', () => {
    expect(connectionStatus({ ...base, isError: true })).toBe('error')
    expect(connectionStatus({ ...base, isError: true, hasData: false })).toBe('error')
  })
})

describe('appendReading', () => {
  it('acrescenta leituras em ordem', () => {
    const history = appendReading(appendReading([], reading(1000)), reading(2000))
    expect(history.map((r) => r.at)).toEqual([1000, 2000])
  })

  it('ignora leitura repetida ou fora de ordem', () => {
    const history = [reading(1000), reading(2000)]
    expect(appendReading(history, reading(2000))).toBe(history)
    expect(appendReading(history, reading(1500))).toBe(history)
  })

  it('descarta leituras mais antigas que a janela', () => {
    const history = [reading(0), reading(5000), reading(9000)]
    expect(appendReading(history, reading(12_000), 6000).map((r) => r.at)).toEqual([9000, 12_000])
  })

  it('recomeça quando o experimento muda', () => {
    const history = [reading(1000), reading(2000)]
    const next = appendReading(history, reading(3000, { experimentId: 'SINTETICO-B' }))
    expect(next.map((r) => r.experimentId)).toEqual(['SINTETICO-B'])
  })

  it('converte a telemetria da API em leitura', () => {
    const r = toReading(
      {
        experiment_id: 'X',
        chamber_temperature_c: 1,
        oxygen_concentration_pct: 2,
        flame_spread_rate_mm_s: 3,
        risk_level: 'MODERATE_WARNING',
      },
      42,
    )
    expect(r).toEqual({ at: 42, experimentId: 'X', temperature: 1, oxygen: 2, flameSpread: 3 })
  })
})

describe('chartDomain', () => {
  it('cobre valores e limiares com folga', () => {
    const [min, max] = chartDomain([850, 860], [900])
    expect(min).toBeLessThan(850)
    expect(max).toBeGreaterThan(900)
  })

  it('abre uma faixa quando todos os valores são iguais', () => {
    expect(chartDomain([5, 5])).toEqual([4, 6])
  })
})

describe('formatação', () => {
  it('usa vírgula decimal (pt-BR)', () => {
    expect(formatNumber(854.5)).toBe('854,5')
    expect(formatNumber(1.456, 2)).toBe('1,46')
  })

  it('formata idade em segundos e minutos', () => {
    expect(formatAge(5)).toBe('5 s')
    expect(formatAge(60)).toBe('1 min')
    expect(formatAge(75)).toBe('1 min 15 s')
  })

  it('secondsSince nunca é negativo', () => {
    expect(secondsSince(5000, 3000)).toBe(0)
    expect(secondsSince(1000, 3500)).toBe(2)
  })
})
