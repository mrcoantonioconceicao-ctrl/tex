import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [telemetry, setTelemetry] = useState(null)
  const [telemetryError, setTelemetryError] = useState(null)
  const [query, setQuery] = useState('')
  const [mcpResponse, setMcpResponse] = useState(null)
  const [loading, setLoading] = useState(false)

  const BACKEND_URL = 'http://127.0.0.1:8080'

  useEffect(() => {
    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchTelemetry = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/telemetry/latest`)
      if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`)
      const data = await res.json()
      setTelemetry(data)
      setTelemetryError(null)
    } catch (err) {
      setTelemetryError(err.message)
    }
  }

  const handleMcpSubmit = async (e) => {
    e.preventDefault()
    if (!query) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/mcp/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      const data = await res.json()
      setMcpResponse(data)
    } catch (err) {
      console.error('Erro no MCP:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Tex Labs: verificação da API</h2>
      <p style={{ color: '#666' }}>Fonte de dados: backend Axum (Rust)</p>

      <h3>GET /telemetry/latest</h3>
      {telemetryError ? (
        <p style={{ color: 'red' }}>GET /telemetry/latest falhou ({telemetryError})</p>
      ) : telemetry ? (
        <pre style={{ background: '#f4f4f4', padding: '10px', borderRadius: '5px' }}>
          {JSON.stringify(telemetry, null, 2)}
        </pre>
      ) : (
        <p>A carregar telemetria...</p>
      )}

      <h3>POST /mcp/context</h3>
      <form onSubmit={handleMcpSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="Ex: oxygen, temperatura, chama..." 
          style={{ flex: 1, padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 16px' }}>
          {loading ? 'A enviar...' : 'Enviar'}
        </button>
      </form>

      {mcpResponse && (
        <pre style={{ background: '#f4f4f4', padding: '10px', borderRadius: '5px', marginTop: '15px' }}>
          {JSON.stringify(mcpResponse, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default App
