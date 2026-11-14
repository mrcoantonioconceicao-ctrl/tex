// Cobertura por ambiente (GET /conditions/coverage): que faixa de O₂, pressão e fluxo
// cada investigação do PSI testou, e quantos testes caem no envelope de um ambiente.
// O envelope da base lunar é fato citado no enunciado (docs/conhecimento/enunciado.md);
// o envelope personalizado é escolha de quem usa a tela.
import { useState, type FormEvent } from 'react'
import { describeError } from '../api/client'
import { useConditionCoverage } from '../api/hooks'
import type { ConditionCoverage, CoverageEnvelope } from '../api/types'
import { OriginBadge } from '../catalog/OriginBadge'
import { programLabel } from '../catalog/model'
import { formatRange, NO_VALUE, routeHint } from './format'

type PresetId = 'todas' | 'lua' | 'personalizado'

// 10,2 psi = 0,694 atm
const LUNAR: CoverageEnvelope = { o2_min: 30, pressure_max_atm: 0.694 }

const PRESETS: { id: PresetId; label: string; note: string }[] = [
  { id: 'todas', label: 'Sem filtro', note: 'Faixas testadas por cada investigação, sem envelope.' },
  {
    id: 'lua',
    label: 'Base lunar e rovers',
    note:
      'Enunciado da NASA: O₂ de 30% ou mais e pressão de 10,2 psi (0,694 atm) ou menos, para encurtar a pré-respiração. ' +
      'Não há dados de gravidade parcial no PSI: os testes abaixo são de microgravidade ou de solo.',
  },
  { id: 'personalizado', label: 'Personalizado', note: 'Envelope escolhido por você (O₂ em %, pressão em atm).' },
]

const CARD = 'rounded-lg border border-slate-700 bg-slate-900 p-4'
const INPUT = 'w-24 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm'

type CustomField = 'o2_min' | 'o2_max' | 'pressure_min_atm' | 'pressure_max_atm'

const CUSTOM_FIELDS: { field: CustomField; label: string }[] = [
  { field: 'o2_min', label: 'O₂ mín. (%)' },
  { field: 'o2_max', label: 'O₂ máx. (%)' },
  { field: 'pressure_min_atm', label: 'Pressão mín. (atm)' },
  { field: 'pressure_max_atm', label: 'Pressão máx. (atm)' },
]

function CustomForm({ onApply }: { onApply: (envelope: CoverageEnvelope) => void }) {
  const [values, setValues] = useState<Record<CustomField, string>>({
    o2_min: '',
    o2_max: '',
    pressure_min_atm: '',
    pressure_max_atm: '',
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const envelope: CoverageEnvelope = {}
    for (const { field } of CUSTOM_FIELDS) {
      const raw = values[field].replace(',', '.').trim()
      if (raw !== '') envelope[field] = Number(raw)
    }
    onApply(envelope)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
      {CUSTOM_FIELDS.map(({ field, label }) => (
        <label key={field} className="flex flex-col gap-1 text-xs text-slate-400">
          {label}
          <input
            inputMode="decimal"
            value={values[field]}
            onChange={(event) => setValues({ ...values, [field]: event.target.value })}
            className={INPUT}
          />
        </label>
      ))}
      <button
        type="submit"
        className="rounded border border-sky-600 px-3 py-1 text-sm text-sky-100 hover:bg-sky-900/40 focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        Aplicar
      </button>
    </form>
  )
}

function MatchCell({ item }: { item: ConditionCoverage }) {
  if (item.matching_runs === null) return <span className="text-slate-500">{NO_VALUE}</span>
  const share = item.run_count === 0 ? 0 : item.matching_runs / item.run_count
  return (
    <div className="flex items-center gap-2">
      <span className={`tabular-nums ${item.matching_runs > 0 ? 'font-semibold text-emerald-200' : 'text-slate-400'}`}>
        {item.matching_runs} de {item.run_count}
      </span>
      <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded bg-slate-800">
        <span className="block h-full bg-emerald-500" style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
    </div>
  )
}

function CoverageTable({ items }: { items: ConditionCoverage[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Cobertura de condições por investigação</caption>
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">Investigação</th>
            <th scope="col" className="py-1 pr-3 font-medium">Testes</th>
            <th scope="col" className="py-1 pr-3 font-medium">O₂ (%)</th>
            <th scope="col" className="py-1 pr-3 font-medium">Pressão (atm)</th>
            <th scope="col" className="py-1 pr-3 font-medium">Fluxo (m/s)</th>
            <th scope="col" className="py-1 pr-3 font-medium">Diluentes</th>
            <th scope="col" className="py-1 font-medium">No envelope</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.accession} className="border-t border-slate-800">
              <td className="py-1.5 pr-3">
                <span className="font-medium">{item.name}</span>{' '}
                <span className="text-xs text-slate-400">
                  {item.accession} · {programLabel(item.program)}
                </span>
              </td>
              <td className="py-1.5 pr-3 tabular-nums">{item.run_count}</td>
              <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{formatRange(item.o2_percent)}</td>
              <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{formatRange(item.pressure_atm)}</td>
              <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{formatRange(item.flow_velocity_ms)}</td>
              <td className="py-1.5 pr-3">{item.diluents.length > 0 ? item.diluents.join(', ') : NO_VALUE}</td>
              <td className="py-1.5">
                <MatchCell item={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Com envelope, as investigações com mais testes dentro dele vêm primeiro
function sortByMatch(items: ConditionCoverage[]): ConditionCoverage[] {
  return [...items].sort((a, b) => (b.matching_runs ?? 0) - (a.matching_runs ?? 0))
}

export function CoverageView() {
  const [preset, setPreset] = useState<PresetId>('todas')
  const [custom, setCustom] = useState<CoverageEnvelope>({})
  const envelope = preset === 'lua' ? LUNAR : preset === 'personalizado' ? custom : {}
  const coverage = useConditionCoverage(envelope)

  const items = coverage.data ? sortByMatch(coverage.data.items) : []
  const filtered = items.some((i) => i.matching_runs !== null)
  const matching = items.reduce((sum, i) => sum + (i.matching_runs ?? 0), 0)
  const investigations = items.filter((i) => (i.matching_runs ?? 0) > 0).length
  const synthetic = items.some((i) => i.origin_category === 'Synthetic')
  const note = PRESETS.find((p) => p.id === preset)?.note

  return (
    <section aria-labelledby="coverage-title" className={CARD}>
      <h2 id="coverage-title" className="text-lg font-semibold">
        Cobertura por ambiente
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Que condições de O₂, pressão e fluxo as investigações do PSI já testaram, e quantos testes caem no envelope
        de um ambiente habitado.
      </p>

      <div role="radiogroup" aria-label="Ambiente" className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={preset === id}
            onClick={() => setPreset(id)}
            className={`rounded-full border px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-sky-400 ${
              preset === id ? 'border-sky-400 bg-sky-900/40 text-sky-100' : 'border-slate-600 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {note && <p className="mt-2 text-xs text-slate-400">{note}</p>}
      {preset === 'personalizado' && <CustomForm onApply={setCustom} />}

      {coverage.isPending && <p className="mt-3 text-sm text-slate-400">Carregando cobertura…</p>}
      {coverage.error && (
        <div role="alert" className="mt-3 rounded border border-red-500 bg-red-950/60 p-3 text-sm text-red-100">
          <p className="font-semibold">{describeError(coverage.error)}</p>
          <p className="mt-1">{routeHint(coverage.error) ?? 'Não foi possível carregar a cobertura.'}</p>
        </div>
      )}
      {coverage.data && (
        <div className="mt-3 space-y-2">
          {filtered && (
            <p role="status" className="text-sm">
              <span className="font-semibold">{matching}</span> teste(s) de{' '}
              <span className="font-semibold">{investigations}</span> investigação(ões) caem neste envelope.
            </p>
          )}
          {items.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nenhuma investigação com tabela normalizada.</p>
          ) : (
            <CoverageTable items={items} />
          )}
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {synthetic ? <OriginBadge origin="Synthetic" /> : <OriginBadge origin="Measured" />}
            <span>
              {synthetic
                ? 'Dados sintéticos de demonstração: os códigos PSI-9xxx não existem no PSI.'
                : 'Condições das tabelas experimentais do PSI, em unidades comuns.'}
            </span>
          </p>
        </div>
      )}
    </section>
  )
}
