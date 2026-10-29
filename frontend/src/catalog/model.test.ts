import { describe, expect, it } from 'vitest'
import { formatBytes, formatDate, formatPeriod, pageCount, programLabel, rangeLabel } from './model'

describe('formatDate', () => {
  it('converte AAAA-MM-DD sem deslocar o dia pelo fuso', () => {
    expect(formatDate('2020-01-15')).toBe('15/01/2020')
    expect(formatDate('2022-12-31')).toBe('31/12/2022')
  })

  it('avisa quando a data não foi informada', () => {
    expect(formatDate(null)).toBe('não informada')
  })
})

describe('formatPeriod', () => {
  it('cobre início e fim, só início e nenhum', () => {
    expect(formatPeriod('2020-01-15', '2021-03-01')).toBe('15/01/2020 a 01/03/2021')
    expect(formatPeriod('2020-01-15', null)).toBe('Desde 15/01/2020')
    expect(formatPeriod(null, null)).toBe('Período não informado')
  })
})

describe('formatBytes', () => {
  it('escolhe a unidade e usa vírgula decimal', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(226 * 1024)).toBe('226 KB')
    expect(formatBytes(14 * 1024 ** 4)).toBe('14 TB')
  })

  it('avisa quando o tamanho não foi informado', () => {
    expect(formatBytes(null)).toBe('tamanho não informado')
  })
})

describe('paginação', () => {
  it('conta páginas com pelo menos uma', () => {
    expect(pageCount(0, 10)).toBe(1)
    expect(pageCount(26, 10)).toBe(3)
    expect(pageCount(30, 10)).toBe(3)
  })

  it('descreve o intervalo mostrado', () => {
    expect(rangeLabel(1, 10, 10, 26)).toBe('1 a 10 de 26')
    expect(rangeLabel(3, 10, 6, 26)).toBe('21 a 26 de 26')
    expect(rangeLabel(1, 10, 0, 0)).toBe('Nenhuma investigação')
  })
})

describe('programLabel', () => {
  it('traduz só o Other', () => {
    expect(programLabel('BASS')).toBe('BASS')
    expect(programLabel('Other')).toBe('Outros')
  })
})
