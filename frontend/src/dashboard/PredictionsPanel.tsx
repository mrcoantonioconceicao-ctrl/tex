// Predição de CO por material. Separa na tela o que é fato (testes publicados do
// Saffire, com fonte) do que é hipótese (projeção do modelo, origin_category Synthetic).
import { usePredictionReport } from '../api/hooks'
import type { FitCheck, PredictionReport, PredictionRisk, Projection, ReferenceTest } from '../api/types'
import { formatNumber } from './model'

const CARD = 'rounded-lg border border-slate-700 bg-slate-900 p-4'

const RISK_INFO: Record<PredictionRisk, { label: string; className: string; icon: string }> = {
  WITHIN_SMAC: { label: 'Dentro do SMAC', className: 'border-emerald-500 text-emerald-200', icon: '✓' },
  EXCEEDS_SMAC_24H: { label: 'Acima do SMAC 24 h', className: 'border-amber-400 text-amber-200', icon: '▲' },
  EXCEEDS_SMAC_1H: { label: 'Acima do SMAC 1 h', className: 'border-red-500 text-red-200', icon: '■' },
}

function formatPct(probability: number): string {
  return `${formatNumber(probability * 100, 0)} %`
}

// Escala do gráfico: um pouco acima do maior valor, para o SMAC de 1 h sempre aparecer
function scaleMax(report: PredictionReport): number {
  const highest = Math.max(report.smac_co.limit_1h_ppm, ...report.projections.map((p) => p.co_p95_ppm))
  return Math.ceil((highest * 1.1) / 50) * 50
}

interface RangeBarProps {
  projection: Projection
  max: number
  limits: PredictionReport['smac_co']
}

// Faixa p5 a p95 com a mediana marcada; linhas verticais nos dois SMAC
function RangeBar({ projection, max, limits }: RangeBarProps) {
  const at = (ppm: number) => `${(ppm / max) * 100}%`
  return (
    <div aria-hidden="true" className="relative h-4 w-full min-w-32 rounded bg-slate-800">
      <span className="absolute inset-y-0 w-px bg-amber-400" style={{ left: at(limits.limit_24h_ppm) }} />
      <span className="absolute inset-y-0 w-px bg-red-500" style={{ left: at(limits.limit_1h_ppm) }} />
      <span
        className="absolute inset-y-1 rounded bg-sky-500/60"
        style={{ left: at(projection.co_p05_ppm), width: at(projection.co_p95_ppm - projection.co_p05_ppm) }}
      />
      <span className="absolute inset-y-0 w-0.5 bg-sky-100" style={{ left: at(projection.co_p50_ppm) }} />
    </div>
  )
}

function RiskChip({ risk }: { risk: PredictionRisk }) {
  const info = RISK_INFO[risk]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${info.className}`}>
      <span aria-hidden="true">{info.icon}</span>
      {info.label}
    </span>
  )
}

function ProjectionsTable({ report }: { report: PredictionReport }) {
  const max = scaleMax(report)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Projeção do modelo (hipótese, dado sintético): CO em ppm por material e fração de O₂
        </caption>
        <thead className="text-xs text-slate-400">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">Material</th>
            <th scope="col" className="py-2 pr-3 font-medium">O₂</th>
            <th scope="col" className="py-2 pr-3 font-medium">CO projetado (mediana, faixa p5 a p95)</th>
            <th scope="col" className="py-2 pr-3 font-medium">P(&gt; 24 h)</th>
            <th scope="col" className="py-2 pr-3 font-medium">P(&gt; 1 h)</th>
            <th scope="col" className="py-2 font-medium">Pior caso (p95)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {report.projections.map((p) => (
            <tr key={`${p.material}-${p.o2_pct}`}>
              <th scope="row" className="py-2 pr-3 font-medium">{p.material}</th>
              <td className="py-2 pr-3 tabular-nums">{formatNumber(p.o2_pct, 0)} %</td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-3">
                  <span className="w-40 shrink-0 tabular-nums">
                    {formatNumber(p.co_p50_ppm, 0)} ppm{' '}
                    <span className="text-slate-400">
                      ({formatNumber(p.co_p05_ppm, 0)} a {formatNumber(p.co_p95_ppm, 0)})
                    </span>
                  </span>
                  <RangeBar projection={p} max={max} limits={report.smac_co} />
                </div>
              </td>
              <td className="py-2 pr-3 tabular-nums">{formatPct(p.prob_exceeds_24h)}</td>
              <td className="py-2 pr-3 tabular-nums">{formatPct(p.prob_exceeds_1h)}</td>
              <td className="py-2">
                <RiskChip risk={p.risk_level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span><span aria-hidden="true" className="mr-1 inline-block h-3 w-px bg-amber-400 align-middle" />SMAC 24 h</span>
        <span><span aria-hidden="true" className="mr-1 inline-block h-3 w-px bg-red-500 align-middle" />SMAC 1 h</span>
        <span>Escala de 0 a {formatNumber(max, 0)} ppm</span>
      </p>
    </div>
  )
}

function ReferenceTable({ tests, fit }: { tests: ReferenceTest[]; fit: FitCheck[] }) {
  const fitById = new Map(fit.map((f) => [f.test_id, f]))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Testes publicados do Saffire IV a VI e a comparação com o modelo</caption>
        <thead className="text-xs text-slate-400">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">Teste</th>
            <th scope="col" className="py-2 pr-3 font-medium">Amostra</th>
            <th scope="col" className="py-2 pr-3 font-medium">Pressão</th>
            <th scope="col" className="py-2 pr-3 font-medium">O₂</th>
            <th scope="col" className="py-2 pr-3 font-medium">ΔCO medido</th>
            <th scope="col" className="py-2 font-medium">Modelo (erro)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {tests.map((t) => {
            const check = fitById.get(t.test_id)
            return (
              <tr key={t.test_id}>
                <th scope="row" className="py-2 pr-3 font-medium whitespace-nowrap">{t.test_id}</th>
                <td className="py-2 pr-3">{t.specimen}</td>
                <td className="py-2 pr-3 tabular-nums">{formatNumber(t.pressure_kpa)} kPa</td>
                <td className="py-2 pr-3 tabular-nums">{formatNumber(t.o2_pct)} %</td>
                <td className="py-2 pr-3 tabular-nums font-medium">{formatNumber(t.delta_co_ppm, 0)} ppm</td>
                <td className="py-2 tabular-nums text-slate-300">
                  {check
                    ? `${formatNumber(check.predicted_ppm, 0)} ppm (${check.error_pct > 0 ? '+' : ''}${formatNumber(check.error_pct)} %)`
                    : 'n/d'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReportBody({ report }: { report: PredictionReport }) {
  const { smac_co: smac, model } = report
  return (
    <>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded border border-amber-400/60 px-3 py-2">
          <dt className="text-slate-400">SMAC de CO, 24 h</dt>
          <dd className="text-lg tabular-nums">{formatNumber(smac.limit_24h_ppm, 0)} ppm</dd>
        </div>
        <div className="rounded border border-red-500/60 px-3 py-2">
          <dt className="text-slate-400">SMAC de CO, 1 h</dt>
          <dd className="text-lg tabular-nums">{formatNumber(smac.limit_1h_ppm, 0)} ppm</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-400">
        Fonte: {smac.source}. Atenção: {smac.divergence}.
      </p>

      <h3 className="mt-5 flex flex-wrap items-center gap-2 font-medium">
        Projeção do modelo
        <span className="rounded-full border border-sky-600 px-2 py-0.5 text-xs text-sky-200">hipótese · sintético</span>
      </h3>
      <p className="mt-1 text-sm text-slate-400">{model.description}</p>
      <div className="mt-3">
        <ProjectionsTable report={report} />
      </div>

      <h3 className="mt-5 flex flex-wrap items-center gap-2 font-medium">
        Base: testes publicados
        <span className="rounded-full border border-emerald-600 px-2 py-0.5 text-xs text-emerald-200">fato · publicado</span>
      </h3>
      <div className="mt-2">
        <ReferenceTable tests={report.reference_tests} fit={report.fit_check} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Fonte: {report.reference_tests[0]?.source ?? 'n/d'}. O erro do modelo é medido nos mesmos testes usados no
        ajuste (dentro da amostra), então não comprova capacidade de prever queimas novas.
        {report.not_ignited.map((n) => ` ${n.material} não acendeu no ${n.test} (${n.source}).`)}
      </p>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-slate-300">Hipóteses do modelo (não validadas)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-400">
          {model.hypotheses.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Gerado por <code>{report.generated_by}</code>, semente {report.seed}.
        </p>
      </details>
    </>
  )
}

export function PredictionsPanel() {
  const report = usePredictionReport()
  return (
    <section aria-labelledby="predictions-title" className={CARD}>
      <h2 id="predictions-title" className="text-lg font-medium">
        Predição de CO por material (Saffire IV a VI)
      </h2>
      {report.isPending && <p className="mt-2 text-sm text-slate-400">Carregando…</p>}
      {report.error && (
        <div role="alert" className="mt-2 text-sm text-red-300">
          <p className="font-semibold">Relatório de predições inválido</p>
          <pre className="whitespace-pre-wrap">{report.error.message}</pre>
        </div>
      )}
      {report.data && <ReportBody report={report.data} />}
    </section>
  )
}
