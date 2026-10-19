// Blocos visuais do painel. Cor nunca é o único sinal: risco e conexão sempre
// trazem texto e forma (ícone) junto.
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, ContractError, NetworkError } from '../api/client'
import { useMcpContext, useSimulationControl } from '../api/hooks'
import type { CombustionTelemetry, SystemPerformanceMetrics } from '../api/types'
import { getMockScenario, isMockScenario, MOCK_SCENARIOS, setMockScenario } from '../mocks/scenario'
import { describeRisk, formatAge, formatNumber, STALE_AFTER_POLLS, type ConnectionStatus, type RiskTone } from './model'

const CARD = 'rounded-lg border border-slate-700 bg-slate-900 p-4'

// ---- Risco ----

const RISK_STYLES: Record<RiskTone, string> = {
  ok: 'border-emerald-500 bg-emerald-950/40 text-emerald-100',
  warning: 'border-amber-400 bg-amber-950/40 text-amber-100',
  critical: 'border-red-500 bg-red-950/60 text-red-100',
  unknown: 'border-slate-500 bg-slate-800 text-slate-100',
}

function RiskIcon({ tone }: { tone: RiskTone }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-8 shrink-0">
      {tone === 'ok' && (
        <>
          <circle cx="12" cy="12" r="11" className="fill-emerald-500" />
          <path d="m6.5 12.5 3.5 3.5 7.5-8" fill="none" strokeWidth="2.5" className="stroke-slate-950" />
        </>
      )}
      {tone === 'warning' && (
        <>
          <path d="M12 2 23 21H1Z" className="fill-amber-400" />
          <path d="M11 9h2v6h-2zm0 8h2v2h-2z" className="fill-slate-950" />
        </>
      )}
      {tone === 'critical' && (
        <>
          <path d="M8 1h8l7 7v8l-7 7H8l-7-7V8Z" className="fill-red-500" />
          <path d="M6 11h12v2H6z" className="fill-white" />
        </>
      )}
      {tone === 'unknown' && (
        <>
          <circle cx="12" cy="12" r="11" className="fill-slate-400" />
          <path d="M11 16h2v2h-2zm1-11a4 4 0 0 1 2 7.5V14h-2v-3a2 2 0 1 0-2-2H8a4 4 0 0 1 4-4" className="fill-slate-950" />
        </>
      )}
    </svg>
  )
}

export function RiskPanel({ telemetry, outdated }: { telemetry: CombustionTelemetry; outdated: boolean }) {
  const risk = describeRisk(telemetry.risk_level)
  return (
    <section aria-labelledby="risk-title" className={`rounded-lg border-2 p-4 ${RISK_STYLES[risk.tone]}`}>
      <h2 id="risk-title" className="text-xs font-medium uppercase tracking-wide opacity-80">
        Nível de risco{outdated && ' (última leitura recebida)'}
      </h2>
      <div aria-live="polite" className="mt-2 flex items-center gap-3">
        <RiskIcon tone={risk.tone} />
        <p className="text-2xl font-semibold">{risk.label}</p>
      </div>
      <p className="mt-2 text-sm opacity-90">{risk.description}</p>
      {telemetry.suppression_active && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-current px-3 py-1 text-sm font-medium">
          <span aria-hidden="true">❄</span> Supressão ativa
        </p>
      )}
      <p className="mt-3 text-xs opacity-75">
        Código <code>{telemetry.risk_level}</code> · Experimento <code>{telemetry.experiment_id}</code>
      </p>
      {risk.tone === 'critical' && !outdated && (
        <p role="alert" className="sr-only">
          Alerta crítico: {risk.label}. {risk.description}
        </p>
      )}
    </section>
  )
}

// ---- Leituras ----

interface ReadingTileProps {
  label: string
  value: number
  unit: string
  digits?: number
  outdated: boolean
}

export function ReadingTile({ label, value, unit, digits = 1, outdated }: ReadingTileProps) {
  return (
    <div className={`${CARD} ${outdated ? 'opacity-60' : ''}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {formatNumber(value, digits)} <span className="text-base font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  )
}

// ---- Conexão ----

const CONNECTION_STYLES: Record<ConnectionStatus, { dot: string; label: string }> = {
  connecting: { dot: 'bg-slate-400', label: 'Conectando…' },
  live: { dot: 'bg-emerald-400', label: 'Ao vivo' },
  stale: { dot: 'bg-amber-400', label: 'Desatualizado' },
  error: { dot: 'bg-red-500', label: 'Falha na conexão' },
}

// Sem aria-live de propósito: muda a cada segundo. Quem anuncia é o StatusBanner.
export function ConnectionBadge({ status, ageSeconds }: { status: ConnectionStatus; ageSeconds: number | null }) {
  const style = CONNECTION_STYLES[status]
  return (
    <p className="flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-sm">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${style.dot} ${status === 'live' ? 'animate-pulse' : ''}`} />
      <span>{style.label}</span>
      {ageSeconds !== null && <span className="text-slate-400">· atualizado há {formatAge(ageSeconds)}</span>}
    </p>
  )
}

function describeError(error: Error): string {
  if (error instanceof NetworkError) return 'Sem conexão com o backend'
  if (error instanceof ContractError) return 'Resposta fora do contrato'
  if (error instanceof ApiError) return `Backend respondeu com erro ${error.status}`
  return 'Erro inesperado'
}

interface StatusBannerProps {
  status: ConnectionStatus
  error: Error | null
  hasData: boolean
}

export function StatusBanner({ status, error, hasData }: StatusBannerProps) {
  if (status === 'error' && error) {
    return (
      <div role="alert" className="rounded-lg border border-red-500 bg-red-950/60 p-4 text-red-100">
        <p className="font-semibold">{describeError(error)}</p>
        <pre className="mt-1 text-sm whitespace-pre-wrap">{error.message}</pre>
        {hasData && (
          <p className="mt-2 text-sm">Exibindo a última leitura recebida: os valores podem não refletir o estado atual.</p>
        )}
      </div>
    )
  }
  if (status === 'stale') {
    return (
      <div role="status" className="rounded-lg border border-amber-400 bg-amber-950/40 p-4 text-amber-100">
        <p className="font-semibold">Dados desatualizados</p>
        <p className="text-sm">
          Nenhuma leitura nova nos últimos {STALE_AFTER_POLLS} ciclos de atualização. O backend pode estar lento.
        </p>
      </div>
    )
  }
  return null
}

// ---- Controles da simulação (demo) ----

export function SimulationControls({ suppressionActive }: { suppressionActive: boolean }) {
  const control = useSimulationControl()

  return (
    <section aria-labelledby="controls-title" className={CARD}>
      <h2 id="controls-title" className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Controles da simulação
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => control.mutate('suppress')}
          disabled={control.isPending || suppressionActive}
          className="rounded border border-sky-500 px-4 py-2 text-sky-200 hover:bg-sky-950 disabled:opacity-50"
        >
          Acionar supressão
        </button>
        <button
          type="button"
          onClick={() => control.mutate('reset')}
          disabled={control.isPending}
          className="rounded border border-slate-500 px-4 py-2 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Reiniciar simulação
        </button>
      </div>
      {control.isError && <p className="mt-2 text-sm text-red-300">{control.error.message}</p>}
    </section>
  )
}

// ---- Métricas ----

interface MetricsPanelProps {
  data: SystemPerformanceMetrics | undefined
  error: Error | null
}

export function MetricsPanel({ data, error }: MetricsPanelProps) {
  return (
    <section aria-labelledby="metrics-title" className={CARD}>
      <h2 id="metrics-title" className="font-medium">
        Desempenho do sistema
      </h2>
      {error && !data && <p className="mt-2 text-sm text-red-300">{error.message}</p>}
      {!error && !data && <p className="mt-2 text-sm text-slate-400">Carregando…</p>}
      {data && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400">Parser AST</dt>
              <dd className="text-lg tabular-nums">{data.ast_parsing_latency_us} µs</dd>
            </div>
            <div>
              <dt className="text-slate-400">Consulta GraphRAG</dt>
              <dd className="text-lg tabular-nums">{data.graphrag_query_latency_us} µs</dd>
            </div>
            <div>
              <dt className="text-slate-400">Eficiência do Token Crusher</dt>
              <dd className="text-lg tabular-nums">{formatNumber(data.token_crusher_efficiency_pct)} %</dd>
            </div>
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd className="text-lg">
                <code>{data.uptime_status}</code>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">Valores informados pelo backend em /api/v1/metrics.</p>
        </>
      )}
    </section>
  )
}

// ---- Consulta MCP ----

export function McpPanel() {
  const mcp = useMcpContext()
  const [query, setQuery] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (query.trim()) mcp.mutate({ query: query.trim() })
  }

  return (
    <section aria-labelledby="mcp-title" className={CARD}>
      <h2 id="mcp-title" className="font-medium">
        Consulta de contexto técnico (MCP)
      </h2>
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <label htmlFor="mcp-query" className="sr-only">
          Consulta
        </label>
        <input
          id="mcp-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Consulta"
          className="flex-1 rounded border border-slate-600 bg-slate-950 px-3 py-2"
        />
        <button
          type="submit"
          disabled={mcp.isPending}
          className="rounded border border-sky-500 px-4 py-2 text-sky-200 hover:bg-sky-950 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
      {mcp.isError && <p className="mt-2 text-sm text-red-300">{mcp.error.message}</p>}
      {mcp.data && (
        <div aria-live="polite" className="mt-3 space-y-2 text-sm">
          <p className="rounded bg-slate-950 p-3">{mcp.data.compressed_context}</p>
          <p className="text-slate-400">
            {mcp.data.protocol} · {mcp.data.status} · {mcp.data.token_metrics.compressed_tokens} de{' '}
            {mcp.data.token_metrics.original_estimated_tokens} tokens (
            {formatNumber(mcp.data.token_metrics.compression_efficiency_pct)} % de compressão)
          </p>
        </div>
      )}
    </section>
  )
}

// ---- Cenários de mock ----

export function ScenarioPicker() {
  const queryClient = useQueryClient()
  const [scenario, setScenario] = useState(getMockScenario)

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value
    if (!isMockScenario(next)) return
    setMockScenario(next)
    setScenario(next)
    const url = new URL(window.location.href)
    url.searchParams.set('cenario', next)
    window.history.replaceState(null, '', url)
    // invalidate (e não reset) mantém a última leitura: assim dá para ver o painel degradar
    void queryClient.invalidateQueries()
  }

  return (
    <p className="flex items-center gap-2 text-sm">
      <label htmlFor="mock-scenario" className="text-slate-400">
        Cenário do mock
      </label>
      <select
        id="mock-scenario"
        value={scenario}
        onChange={handleChange}
        className="rounded border border-slate-600 bg-slate-950 px-2 py-1"
      >
        {Object.entries(MOCK_SCENARIOS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </p>
  )
}
