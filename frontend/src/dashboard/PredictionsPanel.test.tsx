import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import predictionReportJson from '../data/predicoes.json'
import { ContractError, getPredictionReport } from '../api/client'
import { PredictionsPanel } from './PredictionsPanel'

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PredictionsPanel />
    </QueryClientProvider>,
  )
}

describe('getPredictionReport', () => {
  it('valida o relatório gerado por simulation/predicoes.py', async () => {
    const report = await getPredictionReport()

    expect(report.projections.length).toBeGreaterThan(0)
    expect(report.projections.every((p) => p.origin_category === 'Synthetic')).toBe(true)
    expect(report.reference_tests.every((t) => t.origin_category === 'Published')).toBe(true)
  })

  it('lança ContractError quando a projeção vem com probabilidade fora de 0 a 1', async () => {
    const broken = {
      ...predictionReportJson,
      projections: [{ ...predictionReportJson.projections[0], prob_exceeds_24h: 1.5 }],
    }

    await expect(getPredictionReport(broken)).rejects.toBeInstanceOf(ContractError)
  })

  it('lança ContractError quando falta o limite SMAC', async () => {
    const broken: Record<string, unknown> = { ...predictionReportJson }
    delete broken.smac_co

    await expect(getPredictionReport(broken)).rejects.toThrow(/smac_co/)
  })
})

describe('PredictionsPanel', () => {
  it('mostra os SMAC com a fonte', async () => {
    renderPanel()

    expect(await screen.findByText('SMAC de CO, 24 h')).toBeInTheDocument()
    expect(screen.getByText('425 ppm')).toBeInTheDocument()
    expect(screen.getByText(/JSC 20584/)).toBeInTheDocument()
  })

  it('separa a projeção (hipótese) dos testes publicados (fato)', async () => {
    renderPanel()

    expect(await screen.findByText('hipótese · sintético')).toBeInTheDocument()
    expect(screen.getByText('fato · publicado')).toBeInTheDocument()
    const published = screen.getByRole('table', { name: /Testes publicados/ })
    expect(within(published).getByText('Saffire VI-3')).toBeInTheDocument()
    expect(within(published).getByText('308 ppm')).toBeInTheDocument()
  })

  it('lista uma linha por material e fração de O₂ com o status do pior caso', async () => {
    renderPanel()

    const projections = await screen.findByRole('table', { name: /Projeção do modelo/ })
    // cabeçalho + uma linha por projeção
    expect(within(projections).getAllByRole('row')).toHaveLength(predictionReportJson.projections.length + 1)
    expect(within(projections).getAllByText('Acima do SMAC 1 h').length).toBeGreaterThan(0)
  })
})
