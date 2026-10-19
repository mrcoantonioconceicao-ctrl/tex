// Tela provisória de verificação da integração (mock ou Axum).
// O dashboard de verdade será desenhado a partir de 14/11, com o enunciado oficial.
import { useState, type FormEvent } from 'react'
import { useLatestTelemetry, useMcpContext } from './api/hooks'

const dataSource = import.meta.env.VITE_USE_MOCKS === 'true' ? 'mock (MSW)' : 'backend Axum'

function App() {
  const telemetry = useLatestTelemetry()
  const mcp = useMcpContext()
  const [query, setQuery] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (query.trim()) mcp.mutate({ query: query.trim() })
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
      <header>
        <h1 className="text-2xl font-semibold">Tex Labs: verificação da API</h1>
        <p className="text-sm text-gray-500">Fonte de dados: {dataSource}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">GET /telemetry/latest</h2>
        {telemetry.isPending && <p>Carregando…</p>}
        {telemetry.isError && <p className="text-red-600">{telemetry.error.message}</p>}
        {telemetry.data && (
          <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-sm text-gray-900">
            {JSON.stringify(telemetry.data, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">POST /mcp/context</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Consulta"
            className="flex-1 rounded border px-3 py-2"
          />
          <button type="submit" disabled={mcp.isPending} className="rounded border px-4 py-2">
            Enviar
          </button>
        </form>
        {mcp.isError && <p className="text-red-600">{mcp.error.message}</p>}
        {mcp.data && (
          <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-sm text-gray-900">
            {JSON.stringify(mcp.data, null, 2)}
          </pre>
        )}
      </section>
    </main>
  )
}

export default App
