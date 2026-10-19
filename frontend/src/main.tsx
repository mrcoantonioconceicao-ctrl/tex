import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { isMockScenario, setMockScenario } from './mocks/scenario'

const queryClient = new QueryClient()

async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return
  // ?cenario=critico (etc.) abre o painel já no cenário escolhido; ver mocks/scenario.ts
  const requested = new URLSearchParams(window.location.search).get('cenario')
  if (isMockScenario(requested)) setMockScenario(requested)
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
})
