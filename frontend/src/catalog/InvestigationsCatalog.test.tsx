import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { listInvestigations, MOCK_INVESTIGATIONS } from '../mocks/investigations'
import { server } from '../mocks/node'
import { setMockScenario } from '../mocks/scenario'
import { InvestigationsCatalog } from './InvestigationsCatalog'

function renderCatalog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <InvestigationsCatalog />
    </QueryClientProvider>,
  )
}

const results = () => screen.getByRole('region', { name: 'Resultados' })

describe('InvestigationsCatalog', () => {
  it('lista as investigações com total e aviso de dado sintético', async () => {
    renderCatalog()

    expect(await screen.findByText('1 a 6 de 6')).toBeInTheDocument()
    expect(within(results()).getAllByRole('listitem')).toHaveLength(MOCK_INVESTIGATIONS.length)
    expect(screen.getByRole('note')).toHaveTextContent(/sintéticos e não existem no PSI/)
  })

  it('filtra por programa e volta para a lista completa ao limpar', async () => {
    const user = userEvent.setup()
    renderCatalog()
    await screen.findByText('1 a 6 de 6')

    await user.selectOptions(screen.getByLabelText('Programa'), 'FLEX')

    expect(await screen.findByText('1 a 1 de 1')).toBeInTheDocument()
    expect(within(results()).getByText('FLEX-2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(await screen.findByText('1 a 6 de 6')).toBeInTheDocument()
  })

  it('filtra por ambiente com rótulo em português', async () => {
    const user = userEvent.setup()
    renderCatalog()
    await screen.findByText('1 a 6 de 6')

    await user.selectOptions(screen.getByLabelText('Ambiente do experimento'), 'Solo')

    expect(await screen.findByText('1 a 1 de 1')).toBeInTheDocument()
    expect(within(results()).getAllByRole('listitem')).toHaveLength(1)
    expect(within(results()).getByRole('button', { name: /PSI-9005/ })).toBeInTheDocument()
  })

  it('só busca o texto ao enviar o formulário', async () => {
    const user = userEvent.setup()
    renderCatalog()
    await screen.findByText('1 a 6 de 6')

    await user.type(screen.getByRole('searchbox'), 'saffire')
    expect(screen.getByText('1 a 6 de 6')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('1 a 1 de 1')).toBeInTheDocument()
    expect(within(results()).getByText('SAFFIRE-II')).toBeInTheDocument()
  })

  it('mostra estado vazio quando nada casa', async () => {
    const user = userEvent.setup()
    renderCatalog()
    await screen.findByText('1 a 6 de 6')

    await user.type(screen.getByRole('searchbox'), 'nada-casa-com-isto')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Nenhuma investigação com esses filtros.')).toBeInTheDocument()
  })

  it('pagina com os botões e desabilita nas pontas', async () => {
    const user = userEvent.setup()
    // Mesmas regras do mock, mas com 1 item por página para ter várias páginas
    server.use(
      http.get('*/api/v1/investigations', ({ request }) => {
        const params = new URL(request.url).searchParams
        params.set('page_size', '1')
        const { status, body } = listInvestigations(params)
        return HttpResponse.json(body, { status })
      }),
    )
    renderCatalog()

    expect(await screen.findByText('Página 1 de 6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    expect(await screen.findByText('Página 2 de 6')).toBeInTheDocument()
    expect(screen.getByText('2 a 2 de 6')).toBeInTheDocument()
    expect(within(results()).getByText('BASS-II')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
  })

  it('abre o detalhe com textos da fonte, citação e arquivos, e fecha', async () => {
    const user = userEvent.setup()
    renderCatalog()

    await user.click(await screen.findByRole('button', { name: /ACME BRE/ }))

    const detail = await screen.findByRole('region', { name: 'ACME BRE (PSI-9003)' })
    expect(within(detail).getByText('Objetivo sintético de ACME BRE.')).toBeInTheDocument()
    // abordagem e hipótese vêm null no mock
    expect(within(detail).getAllByText('Não informado pelo PSI')).toHaveLength(2)
    expect(within(detail).getByText('CC0-1.0')).toBeInTheDocument()
    expect(within(detail).getAllByText('não baixado')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /ACME BRE/ })).toHaveAttribute('aria-current', 'true')

    await user.click(within(detail).getByRole('button', { name: /Fechar/ }))

    expect(screen.queryByRole('region', { name: /PSI-9003/ })).not.toBeInTheDocument()
    expect(screen.getByText('Selecione uma investigação para ver o detalhe.')).toBeInTheDocument()
  })

  it('mostra o erro e tenta de novo quando o backend está fora', async () => {
    const user = userEvent.setup()
    setMockScenario('offline')
    renderCatalog()

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o backend')

    setMockScenario('backend')
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('1 a 6 de 6')).toBeInTheDocument()
  })

  it('mostra erro no detalhe sem derrubar a lista', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/v1/investigations/:accession', () => new HttpResponse(null, { status: 500 })))
    renderCatalog()

    await user.click(await screen.findByRole('button', { name: /FLEX-2/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend respondeu com erro 500')
    expect(within(results()).getAllByRole('listitem')).toHaveLength(MOCK_INVESTIGATIONS.length)
  })
})
