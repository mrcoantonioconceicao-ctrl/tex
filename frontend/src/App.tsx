// Painel de monitoramento (base estrutural). As telas específicas do desafio
// serão desenhadas a partir de 14/11, com o enunciado oficial.
import { TELEMETRY_POLL_MS, useLatestTelemetry, useSystemMetrics } from './api/hooks'
import { useNow, useTelemetryHistory } from './dashboard/hooks'
import { connectionStatus, secondsSince, TEMPERATURE_THRESHOLDS } from './dashboard/model'
import {
  ConnectionBadge,
  McpPanel,
  MetricsPanel,
  ReadingTile,
  RiskPanel,
  ScenarioPicker,
  StatusBanner,
} from './dashboard/panels'
import { TrendChart } from './dashboard/TrendChart'

const usingMocks = import.meta.env.VITE_USE_MOCKS === 'true'
const dataSource = usingMocks ? 'mock (MSW)' : 'backend Axum'

function App() {
  const telemetry = useLatestTelemetry()
  const metrics = useSystemMetrics()
  const now = useNow()
  const history = useTelemetryHistory(telemetry.data, telemetry.dataUpdatedAt)

  const status = connectionStatus({
    hasData: telemetry.data !== undefined,
    isError: telemetry.isError,
    updatedAt: telemetry.dataUpdatedAt,
    now,
    pollMs: TELEMETRY_POLL_MS,
  })
  const ageSeconds = telemetry.data ? secondsSince(telemetry.dataUpdatedAt, now) : null
  const outdated = status === 'stale' || status === 'error'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Tex Labs: monitoramento de combustão</h1>
            <p className="text-sm text-slate-400">Fonte de dados: {dataSource}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {usingMocks && <ScenarioPicker />}
            <ConnectionBadge status={status} ageSeconds={ageSeconds} />
          </div>
        </header>

        <StatusBanner status={status} error={telemetry.error} hasData={telemetry.data !== undefined} />

        {telemetry.data && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <RiskPanel telemetry={telemetry.data} outdated={outdated} />
              <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
                <ReadingTile
                  label="Temperatura da câmara"
                  value={telemetry.data.chamber_temperature_c}
                  unit="°C"
                  outdated={outdated}
                />
                <ReadingTile
                  label="Oxigênio"
                  value={telemetry.data.oxygen_concentration_pct}
                  unit="%"
                  outdated={outdated}
                />
                <ReadingTile
                  label="Propagação da chama"
                  value={telemetry.data.flame_spread_rate_mm_s}
                  unit="mm/s"
                  digits={2}
                  outdated={outdated}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TrendChart
                title="Temperatura da câmara"
                unit="°C"
                readings={history}
                select={(r) => r.temperature}
                thresholds={TEMPERATURE_THRESHOLDS}
              />
              <TrendChart title="Oxigênio" unit="%" readings={history} select={(r) => r.oxygen} />
            </div>
          </>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <MetricsPanel data={metrics.data} error={metrics.error} />
          <McpPanel />
        </div>
      </main>
    </div>
  )
}

export default App
