// Testes de uma investigação (GET /investigations/{accession}/runs): uma linha por
// linha da tabela do PSI, com as condições em unidades comuns e a variável escolhida
// na unidade da fonte. Valor a validar aparece marcado, nunca escondido nem corrigido.
import { useState, type ChangeEvent } from 'react'
import { describeError } from '../api/client'
import { useRuns } from '../api/hooks'
import type { ExperimentalRun, RunPage, VariableSummary } from '../api/types'
import { OriginBadge } from '../catalog/OriginBadge'
import { formatNumber, NO_VALUE, routeHint } from './format'

const PAGE_SIZE = 100

function variableLabel(v: VariableSummary): string {
  const pending = v.pending_count > 0 ? `, ${v.pending_count} a validar` : ''
  return `${v.variable} (${v.unit}) · ${v.count} valor(es)${pending}`
}

// Variável + unidade: a mesma variável pode vir em unidades diferentes (ex.: mm e cm)
const keyOf = (v: { variable: string; unit: string }) => `${v.variable}|${v.unit}`

function ValueCell({ run, variable }: { run: ExperimentalRun; variable: VariableSummary }) {
  const measurement = run.measurements.find((m) => keyOf(m) === keyOf(variable))
  if (!measurement || measurement.value === null) return <span className="text-slate-500">{NO_VALUE}</span>
  const pending = measurement.quality_status === 'PENDING_VALIDATION'
  return (
    <span className={pending ? 'text-amber-200' : undefined}>
      {formatNumber(measurement.value)}
      {pending && (
        <span className="ml-1 text-xs" title="Valor aproximado na fonte, fora da faixa esperada ou com dúvida de unidade">
          (a validar)
        </span>
      )}
    </span>
  )
}

function RunsTable({ page, variable }: { page: RunPage; variable: VariableSummary }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Testes de {page.accession}</caption>
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">Teste</th>
            <th scope="col" className="py-1 pr-3 font-medium">Amostra</th>
            <th scope="col" className="py-1 pr-3 font-medium">O₂ (%)</th>
            <th scope="col" className="py-1 pr-3 font-medium">Pressão (atm)</th>
            <th scope="col" className="py-1 pr-3 font-medium">Fluxo (m/s)</th>
            <th scope="col" className="py-1 pr-3 font-medium">
              {variable.variable} ({variable.unit})
            </th>
            <th scope="col" className="py-1 font-medium">Desfecho</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((run) => (
            <tr key={`${run.source_file.file_name}|${run.test_label}`} className="border-t border-slate-800">
              <td className="py-1.5 pr-3 whitespace-nowrap">{run.test_label}</td>
              <td className="py-1.5 pr-3">{run.sample_description ?? NO_VALUE}</td>
              <td className="py-1.5 pr-3 tabular-nums">{formatNumber(run.conditions?.o2_percent ?? null)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{formatNumber(run.conditions?.pressure_atm ?? null)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{formatNumber(run.conditions?.flow_velocity_ms ?? null)}</td>
              <td className="py-1.5 pr-3 tabular-nums">
                <ValueCell run={run} variable={variable} />
              </td>
              <td className="py-1.5">{run.outcome ?? NO_VALUE}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (last === 1) return null
  const button =
    'rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-400'
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {last}
      </span>
      <button type="button" className={button} disabled={page >= last} onClick={() => onChange(page + 1)}>
        Próxima
      </button>
    </div>
  )
}

function SourceFiles({ page }: { page: RunPage }) {
  const files = new Map(page.items.map((r) => [r.source_file.file_name, r.source_file.sha256]))
  return (
    <>
      {[...files].map(([name, sha256]) => (
        <span key={name} title={`SHA-256 ${sha256}`}>
          Fonte: {name} (SHA-256 {sha256.slice(0, 12)}…)
        </span>
      ))}
    </>
  )
}

export function RunsPanel({ accession }: { accession: string }) {
  // Chave variável|unidade; a API filtra só pelo nome da variável
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const variableName = selected?.split('|')[0]
  const runs = useRuns(accession, { variable: variableName, page, page_size: PAGE_SIZE })

  const data = runs.data
  const variable = data?.variables.find((v) => keyOf(v) === selected) ?? data?.variables[0]
  const origin = data?.items.flatMap((r) => r.measurements)[0]?.origin_category

  function handleVariable(event: ChangeEvent<HTMLSelectElement>) {
    setSelected(event.target.value)
    setPage(1)
  }

  return (
    <section aria-labelledby="runs-title">
      <h3 id="runs-title" className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Testes e medições {data ? `(${data.total} teste(s))` : ''}
      </h3>

      {runs.isPending && <p className="mt-2 text-sm text-slate-400">Carregando testes…</p>}
      {runs.error && (
        <div role="alert" className="mt-2 rounded border border-red-500 bg-red-950/60 p-3 text-sm text-red-100">
          <p className="font-semibold">{describeError(runs.error)}</p>
          <p className="mt-1">{routeHint(runs.error) ?? `Não foi possível carregar os testes de ${accession}.`}</p>
        </div>
      )}
      {data && data.total === 0 && (
        <p className="mt-2 text-sm text-slate-500 italic">Sem tabela experimental normalizada para esta investigação.</p>
      )}
      {data && data.total > 0 && (
        <div className="mt-2 space-y-2">
          {variable ? (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-400">Variável medida</span>
              <select
                value={keyOf(variable)}
                onChange={handleVariable}
                className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
              >
                {data.variables.map((v) => (
                  <option key={keyOf(v)} value={keyOf(v)}>
                    {variableLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-slate-500 italic">A tabela não tem colunas numéricas: só a linha original.</p>
          )}
          {variable && <RunsTable page={data} variable={variable} />}
          <Pager page={data.page} total={data.total} onChange={setPage} />
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {origin && <OriginBadge origin={origin} />}
            <SourceFiles page={data} />
            <span>Condições em unidades comuns; a variável, na unidade da fonte.</span>
          </p>
        </div>
      )}
    </section>
  )
}
