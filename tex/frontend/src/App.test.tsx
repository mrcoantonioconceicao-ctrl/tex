import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from './App'
import { server } from './mocks/node'

function renderApp() {
  // retry desligado para os testes de erro não esperarem as novas tentativas
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App', () => {
  it('mostra a telemetria recebida da API', async () => {
    renderApp()

    expect(await screen.findByText(/NASA-ISS-CIR-042/)).toBeInTheDocument()
    expect(screen.getByText(/MODERATE_WARNING/)).toBeInTheDocument()
    expect(screen.getByText('Fonte de dados: mock (MSW)')).toBeInTheDocument()
  })

  it('mostra a mensagem de erro quando a telemetria falha', async () => {
    server.use(
      http.get('*/api/v1/telemetry/latest', () => new HttpResponse(null, { status: 500 })),
    )
    renderApp()

    expect(await screen.findByText('GET /telemetry/latest falhou (500)')).toBeInTheDocument()
  })

  it('envia a consulta MCP e mostra a resposta', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Consulta'), 'supressão de oxigênio')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/supressão de oxigênio/)).toBeInTheDocument()
    expect(screen.getByText(/ACTIVE_OPTIMIZED/)).toBeInTheDocument()
  })

  it('não envia consulta vazia', async () => {
    let calls = 0
    server.use(
      http.post('*/api/v1/mcp/context', () => {
        calls++
        return HttpResponse.json({})
      }),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Consulta'), '   ')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(calls).toBe(0)
  })
})
