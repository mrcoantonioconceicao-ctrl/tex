// Telas de medições e cobertura contra o mock MSW (dados sintéticos PSI-9xxx), e o
// próprio mock contra os schemas do contrato.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { conditionCoverageListSchema, runPageSchema } from '../api/schemas'
import { conditionCoverage, listRuns, MOCK_RUNS } from '../mocks/measurements'
import { server } from '../mocks/node'
import { CoverageView } from './CoverageView'
import { RunsPanel } from './RunsPanel'

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const params = (query = '') => new URLSearchParams(query)

describe('mock de medições segue o contrato', () => {
  it('runs e cobertura passam nos schemas', () => {
    for (const accession of [...Object.keys(MOCK_RUNS), 'PSI-9006']) {
      const result = listRuns(accession, params())
      expect(result.status).toBe(200)
      runPageSchema.parse(result.body)
    }
    for (const query of ['', 'o2_min=30&pressure_max_atm=0.694']) {
      const result = conditionCoverage(params(query))
      expect(result.status).toBe(200)
      conditionCoverageListSchema.parse(result.body)
    }
  })

  it('erros do contrato: 400 e 404', () => {
    expect(listRuns('9001', params()).status).toBe(400)
    expect(listRuns('PSI-1', params()).status).toBe(404)
    expect(listRuns('PSI-9001', params('variable=O2')).status).toBe(400)
    expect(listRuns('PSI-9001', params('page_size=501')).status).toBe(400)
    expect(conditionCoverage(params('o2_min=40&o2_max=30')).status).toBe(400)
    expect(conditionCoverage(params('pressure_max_atm=0')).status).toBe(400)
  })

  it('filtro por variável mantém todos os testes', () => {
    const result = listRuns('PSI-9002', params('variable=o2_final'))
    if (result.status !== 200) throw new Error('esperava 200')
    expect(result.body.items).toHaveLength(2)
    expect(result.body.items.every((r) => r.measurements.every((m) => m.variable === 'o2_final'))).toBe(true)
    // Resumo cobre a investigação inteira, não só a variável filtrada
    expect(result.body.variables.map((v) => v.variable)).toEqual(['co_final', 'o2_final', 'o2_initial'])
  })
})

describe('RunsPanel', () => {
  it('mostra os testes com a variável escolhida e marca o valor a validar', async () => {
    const user = userEvent.setup()
    renderWithQuery(<RunsPanel accession="PSI-9002" />)

    const select = await screen.findByLabelText('Variável medida')
    expect(screen.getByText('Testes e medições (2 teste(s))')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'co_final (ppm)' })).toBeInTheDocument()

    await user.selectOptions(select, 'o2_final|%')

    expect(await screen.findByRole('columnheader', { name: 'o2_final (%)' })).toBeInTheDocument()
    const row = screen.getByRole('row', { name: /S2/ })
    expect(within(row).getByText('(a validar)')).toBeInTheDocument()
    expect(screen.getByText('sintético')).toBeInTheDocument()
  })

  it('investigação sem tabela normalizada', async () => {
    renderWithQuery(<RunsPanel accession="PSI-9006" />)
    expect(await screen.findByText(/Sem tabela experimental normalizada/)).toBeInTheDocument()
  })

  it('explica quando o backend ainda não serve a rota', async () => {
    server.use(
      http.get('*/api/v1/investigations/:accession/runs', () =>
        HttpResponse.json({ code: 'NOT_FOUND', message: 'rota não encontrada' }, { status: 404 }),
      ),
    )
    renderWithQuery(<RunsPanel accession="PSI-9001" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/ainda não serve esta rota/)
  })
})

describe('CoverageView', () => {
  it('sem filtro mostra as faixas de cada investigação', async () => {
    renderWithQuery(<CoverageView />)

    const row = await screen.findByRole('row', { name: /PSI-9001/ })
    expect(within(row).getByText('21\u201335')).toBeInTheDocument()
    expect(within(row).getByText('He, N2')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('envelope da base lunar conta os testes dentro dele', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CoverageView />)
    await screen.findByRole('row', { name: /PSI-9001/ })

    await user.click(screen.getByRole('radio', { name: 'Base lunar e rovers' }))

    expect(await screen.findByRole('status')).toHaveTextContent('2 teste(s) de 2 investigação(ões)')
    expect(screen.getByText(/10,2 psi \(0,694 atm\)/)).toBeInTheDocument()
    // S2 do PSI-9001 está a 0,7 atm: fica de fora
    expect(within(screen.getByRole('row', { name: /PSI-9001/ })).getByText('1 de 3')).toBeInTheDocument()
  })

  it('envelope personalizado com vírgula decimal', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CoverageView />)
    await screen.findByRole('row', { name: /PSI-9001/ })

    await user.click(screen.getByRole('radio', { name: 'Personalizado' }))
    await user.type(screen.getByLabelText('O₂ mín. (%)'), '21')
    await user.type(screen.getByLabelText('Pressão máx. (atm)'), '1,0')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('5 teste(s) de 2 investigação(ões)')
  })
})
