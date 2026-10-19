// Gráfico de linha em SVG puro (sem biblioteca): série recente + linhas de limiar.
import { chartDomain, formatAge, formatNumber, type Reading } from './model'

interface Threshold {
  value: number
  label: string
}

interface TrendChartProps {
  title: string
  unit: string
  readings: Reading[]
  select: (reading: Reading) => number
  thresholds?: Threshold[]
  digits?: number
}

const WIDTH = 640
const HEIGHT = 200
const PLOT = { left: 56, right: WIDTH - 12, top: 14, bottom: HEIGHT - 24 }

export function TrendChart({ title, unit, readings, select, thresholds = [], digits = 1 }: TrendChartProps) {
  if (readings.length < 2) {
    return (
      <figure className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <figcaption className="text-sm font-medium text-slate-200">{title}</figcaption>
        <p className="my-6 text-center text-sm text-slate-400">Aguardando leituras para montar o gráfico…</p>
      </figure>
    )
  }

  const values = readings.map(select)
  const [yMin, yMax] = chartDomain(values, thresholds.map((t) => t.value))
  const t0 = readings[0].at
  const t1 = readings[readings.length - 1].at
  const x = (at: number) => PLOT.left + ((at - t0) / (t1 - t0)) * (PLOT.right - PLOT.left)
  const y = (v: number) => PLOT.bottom - ((v - yMin) / (yMax - yMin)) * (PLOT.bottom - PLOT.top)
  const path = readings.map((r, i) => `${i ? 'L' : 'M'}${x(r.at).toFixed(1)},${y(select(r)).toFixed(1)}`).join(' ')

  const current = values[values.length - 1]
  const span = formatAge(Math.round((t1 - t0) / 1000))
  const summary =
    `${title}: atual ${formatNumber(current, digits)} ${unit}, ` +
    `mínimo ${formatNumber(Math.min(...values), digits)}, máximo ${formatNumber(Math.max(...values), digits)}, ` +
    `${readings.length} leituras em ${span}`

  return (
    <figure className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <figcaption className="flex items-baseline justify-between text-sm font-medium text-slate-200">
        <span>{title}</span>
        <span className="tabular-nums text-slate-300">
          {formatNumber(current, digits)} {unit}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary} className="mt-2 h-auto w-full">
        <text x={PLOT.left - 8} y={PLOT.top + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
          {formatNumber(yMax, 0)}
        </text>
        <text x={PLOT.left - 8} y={PLOT.bottom} textAnchor="end" className="fill-slate-400 text-[11px]">
          {formatNumber(yMin, 0)}
        </text>
        <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} className="stroke-slate-700" />
        {thresholds.map((t) => (
          <g key={t.value}>
            <line
              x1={PLOT.left}
              x2={PLOT.right}
              y1={y(t.value)}
              y2={y(t.value)}
              strokeDasharray="6 4"
              className="stroke-amber-400/60"
            />
            <text x={PLOT.right} y={y(t.value) - 4} textAnchor="end" className="fill-amber-300 text-[11px]">
              {t.label}
            </text>
          </g>
        ))}
        <path d={path} fill="none" strokeWidth={2} className="stroke-sky-400" />
        <text x={PLOT.left} y={HEIGHT - 6} className="fill-slate-400 text-[11px]">
          {span} antes
        </text>
        <text x={PLOT.right} y={HEIGHT - 6} textAnchor="end" className="fill-slate-400 text-[11px]">
          última leitura
        </text>
      </svg>
    </figure>
  )
}
