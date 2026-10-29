// Aba de simulação: telemetria sintética, predição de CO, métricas e contexto.
// Saiu do App.tsx sem mudar o comportamento; o catálogo do PSI é a outra aba.
import { TELEMETRY_POLL_MS, useLatestTelemetry, useSystemMetrics } from '../api/hooks'
import { useNow, useTelemetryHistory } from './hooks'
import { connectionStatus, secondsSince, TEMPERATURE_THRESHOLDS } from './model'
import {
  ConnectionBadge,
  McpPanel,
  MetricsPanel,
  ReadingTile,
  RiskPanel,
  SimulationControls,
  StatusBanner,
  SyntheticDataNotice,
} from './panels'
import { PredictionsPanel } from './PredictionsPanel'
import { TrendChart } from './TrendChart'

export function MonitoringView({ usingMocks }: { usingMocks: boolean }) {
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
  // Mock é sempre sintético; com o backend, quem diz é o origin_category da leitura
  const synthetic = usingMocks || telemetry.data?.origin_category === 'Synthetic'

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ConnectionBadge status={status} ageSeconds={ageSeconds} synthetic={synthetic} />
      </div>

      {synthetic && <SyntheticDataNotice />}

      <StatusBanner status={status} error={telemetry.error} hasData={telemetry.data !== undefined} />

      {telemetry.data && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4">
              <RiskPanel telemetry={telemetry.data} outdated={outdated} />
              <SimulationControls suppressionActive={telemetry.data.suppression_active} />
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-3 lg:col-span-2">
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

      {/* Não depende da telemetria: o relatório é estático e aparece mesmo com o backend fora */}
      <PredictionsPanel />

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricsPanel data={metrics.data} error={metrics.error} />
        <McpPanel />
      </div>
    </div>
  )
}
