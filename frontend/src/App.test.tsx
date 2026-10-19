import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from './App'
import { TrendChart } from './dashboard/TrendChart'
import { server } from './mocks/node'
import { setMockScenario } from './mocks/scenario'

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

    expect(await screen.findByText('SIM-TEX-001')).toBeInTheDocument()
    expect(screen.getByText('NOMINAL')).toBeInTheDocument()
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

describe('Painel', () => {
  it('mostra o logo no canto superior esquerdo, decorativo para leitores de tela', () => {
    const { container } = renderApp()

    const logo = container.querySelector('header img')
    expect(logo).toHaveAttribute('src', expect.stringContaining('texlabs'))
    expect(logo).toHaveAttribute('alt', '')
  })

  it('mostra risco, leituras formatadas e métricas', async () => {
    renderApp()

    expect(await screen.findByText('Nominal')).toBeInTheDocument()
    expect(screen.getByText('854,5')).toBeInTheDocument()
    expect(screen.getByText('1,45')).toBeInTheDocument()
    expect(await screen.findByText('14 µs')).toBeInTheDocument()
    // nunca "ao vivo": o dado é sintético e a tela precisa dizer isso
    expect(screen.getByText('Conectado · simulação')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('não representam telemetria real da ISS')
  })

  it('anuncia o risco crítico para leitores de tela', async () => {
    setMockScenario('critico')
    renderApp()

    expect(await screen.findByText('Crítico: supressão ativa')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/Alerta crítico/)
  })

  it('não quebra com nível de risco desconhecido', async () => {
    server.use(
      http.get('*/api/v1/telemetry/latest', () =>
        HttpResponse.json({
          experiment_id: 'X',
          timestamp: '2026-10-19T22:00:00.000Z',
          sequence: 0,
          chamber_temperature_c: 1,
          oxygen_concentration_pct: 1,
          flame_spread_rate_mm_s: 1,
          risk_level: 'NOVO_NIVEL',
          suppression_active: false,
          origin_category: 'Synthetic',
        }),
      ),
    )
    renderApp()

    expect(await screen.findByText('Nível não reconhecido')).toBeInTheDocument()
  })

  it('mostra banner de sem conexão quando o backend está fora', async () => {
    setMockScenario('offline')
    renderApp()

    expect(await screen.findByText('Sem conexão com o backend')).toBeInTheDocument()
    expect(screen.getByText('Falha na conexão')).toBeInTheDocument()
  })

  it('mostra banner de contrato quebrado', async () => {
    setMockScenario('fora-do-contrato')
    renderApp()

    // findByRole: o mesmo texto também existe como opção do seletor de cenário
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Resposta fora do contrato')
    expect(banner).toHaveTextContent(/flame_spread_rate_mm_s/)
  })

  it('mantém a última leitura visível quando o backend cai depois', async () => {
    renderApp()
    expect(await screen.findByText('Nominal')).toBeInTheDocument()

    server.use(http.get('*/api/v1/telemetry/latest', () => HttpResponse.error()))

    expect(await screen.findByText('Sem conexão com o backend', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/Exibindo a última leitura recebida/)).toBeInTheDocument()
    expect(screen.getByText('Nominal')).toBeInTheDocument()
    expect(screen.getByText(/última leitura recebida\)/)).toBeInTheDocument()
  }, 10_000)

  it('troca de cenário pelo seletor', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText('Nominal')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Cenário do mock'), 'critico')

    expect(await screen.findByText('Crítico: supressão ativa')).toBeInTheDocument()
    expect(window.location.search).toBe('?cenario=critico')
  })

  it('aciona a supressão pelo botão e mostra o selo', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText('Nominal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Acionar supressão' }))

    expect(await screen.findByText('Crítico: supressão ativa')).toBeInTheDocument()
    expect(screen.getByText(/Supressão ativa$/)).toBeInTheDocument()
    // com a supressão já ativa, o botão fica desabilitado
    expect(screen.getByRole('button', { name: 'Acionar supressão' })).toBeDisabled()
  })

  it('reinicia a simulação pelo botão', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Acionar supressão' }))
    expect(await screen.findByText('Crítico: supressão ativa')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reiniciar simulação' }))

    expect(await screen.findByText('Nominal')).toBeInTheDocument()
  })
})

describe('TrendChart', () => {
  const readings = [850, 860, 870].map((temperature, i) => ({
    at: i * 2000,
    experimentId: 'SINTETICO-A',
    temperature,
    oxygen: 21,
    flameSpread: 1,
  }))

  it('descreve a série para leitores de tela', () => {
    render(<TrendChart title="Temperatura" unit="°C" readings={readings} select={(r) => r.temperature} />)

    expect(
      screen.getByRole('img', { name: 'Temperatura: atual 870,0 °C, mínimo 850,0, máximo 870,0, 3 leituras em 4 s' }),
    ).toBeInTheDocument()
  })

  it('pede para aguardar com menos de duas leituras', () => {
    render(<TrendChart title="Temperatura" unit="°C" readings={readings.slice(0, 1)} select={(r) => r.temperature} />)

    expect(screen.getByText(/Aguardando leituras/)).toBeInTheDocument()
  })
})
