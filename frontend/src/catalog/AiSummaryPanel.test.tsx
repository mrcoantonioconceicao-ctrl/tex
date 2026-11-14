// Tela do resumo por IA contra o mock MSW (dados sintéticos PSI-9xxx).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { AiSummary } from '../api/types'
import { server } from '../mocks/node'
import { AiSummaryPanel } from './AiSummaryPanel'

const SUMMARIZE = '*/api/v1/ai/summarize'

function renderPanel(accession = 'PSI-9001') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AiSummaryPanel accession={accession} />
    </QueryClientProvider>,
  )
}

async function clickGenerate() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Gerar resumo' }))
  return user
}

describe('AiSummaryPanel', () => {
  it('não pede o resumo antes do clique', () => {
    let calls = 0
    server.use(
      http.post(SUMMARIZE, () => {
        calls++
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderPanel()

    expect(screen.getByRole('button', { name: 'Gerar resumo' })).toBeInTheDocument()
    expect(screen.getByText(/Não é dado da NASA/)).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('mostra o resumo sintético do mock com o selo e os campos de origem', async () => {
    renderPanel()
    await clickGenerate()

    expect(await screen.findByText(/Resumo sintético \(sem modelo de IA\)/)).toBeInTheDocument()
    expect(screen.getByText('sintético')).toBeInTheDocument()
    expect(screen.getByText(/Baseado em: Objetivo/)).toBeInTheDocument()
    expect(screen.getByText('Sem modelo de IA')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gerar resumo' })).not.toBeInTheDocument()
  })

  it('resumo do modelo sai com o selo de IA e o nome do modelo', async () => {
    const inferred: AiSummary = {
      accession: 'PSI-9001',
      summary: 'Texto reformulado pelo modelo.',
      source_fields: ['objective', 'hypothesis'],
      model: 'modelo-teste',
      generated_at: '2026-11-14T14:00:00.000Z',
      origin_category: 'Inferred',
    }
    server.use(http.post(SUMMARIZE, () => HttpResponse.json(inferred)))
    renderPanel()
    await clickGenerate()

    expect(await screen.findByText('Texto reformulado pelo modelo.')).toBeInTheDocument()
    expect(screen.getByText('inferido · IA')).toBeInTheDocument()
    expect(screen.getByText('Modelo modelo-teste')).toBeInTheDocument()
    expect(screen.getByText(/Baseado em: Objetivo, Hipótese/)).toBeInTheDocument()
  })

  it('explica o 422 NO_SOURCE_TEXT sem inventar resumo', async () => {
    server.use(
      http.post(SUMMARIZE, () =>
        HttpResponse.json({ code: 'NO_SOURCE_TEXT', message: 'sem texto' }, { status: 422 }),
      ),
    )
    renderPanel()
    await clickGenerate()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Investigação sem texto para resumir')
    expect(alert).toHaveTextContent(/não há o que resumir sem inventar/)
  })

  it('no 503 avisa que o provedor está fora e permite tentar de novo', async () => {
    let calls = 0
    server.use(
      http.post(SUMMARIZE, () => {
        calls++
        return HttpResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'desligado' }, { status: 503 })
      }),
    )
    renderPanel()
    const user = await clickGenerate()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Serviço indisponível no momento')
    expect(alert).toHaveTextContent(/provedor de IA não está configurado/)
    expect(calls).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(calls).toBe(2))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
