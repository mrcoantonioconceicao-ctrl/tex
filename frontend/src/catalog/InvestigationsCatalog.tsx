// Catálogo das investigações de combustão do PSI (GET /api/v1/investigations).
// Só metadados: ranqueamento por ambiente e resumo por IA entram depois de 14/11.
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { describeError } from '../api/client'
import { useInvestigations } from '../api/hooks'
import type { InvestigationSummary, Program, ProjectType } from '../api/types'
import { InvestigationDetail, OriginBadge } from './InvestigationDetail'
import {
  formatPeriod,
  PAGE_SIZE,
  pageCount,
  PROGRAMS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
  programLabel,
  rangeLabel,
} from './model'

const CARD = 'rounded-lg border border-slate-700 bg-slate-900 p-4'
const CONTROL =
  'rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-sky-400'
const BUTTON = `${CONTROL} hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40`

interface Filters {
  program: Program | ''
  projectType: ProjectType | ''
  q: string
}

const NO_FILTERS: Filters = { program: '', projectType: '', q: '' }

interface FilterBarProps {
  filters: Filters
  onChange: (filters: Filters) => void
}

function FilterBar({ filters, onChange }: FilterBarProps) {
  // Texto só vira filtro ao enviar: não dispara uma busca por tecla
  const [draft, setDraft] = useState(filters.q)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onChange({ ...filters, q: draft.trim() })
  }

  function handleClear() {
    setDraft('')
    onChange(NO_FILTERS)
  }

  const hasFilters = filters.program !== '' || filters.projectType !== '' || filters.q !== ''

  return (
    <form
      role="search"
      aria-label="Filtrar investigações"
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-slate-400">
        Buscar no código, nome, título ou objetivo
        <input
          type="search"
          value={draft}
          maxLength={200}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="ex.: flame, BASS, PSI-25"
          className={CONTROL}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Programa
        <select
          value={filters.program}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...filters, program: event.target.value as Program | '' })
          }
          className={CONTROL}
        >
          <option value="">Todos</option>
          {PROGRAMS.map((program) => (
            <option key={program} value={program}>
              {programLabel(program)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Ambiente do experimento
        <select
          value={filters.projectType}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...filters, projectType: event.target.value as ProjectType | '' })
          }
          className={CONTROL}
        >
          <option value="">Todos</option>
          {PROJECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {PROJECT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={BUTTON}>
        Buscar
      </button>
      {hasFilters && (
        <button type="button" onClick={handleClear} className={BUTTON}>
          Limpar filtros
        </button>
      )}
    </form>
  )
}

interface InvestigationListProps {
  items: InvestigationSummary[]
  selected: string | null
  onSelect: (accession: string) => void
}

function InvestigationList({ items, selected, onSelect }: InvestigationListProps) {
  return (
    <ul className="divide-y divide-slate-800">
      {items.map((item) => {
        const isSelected = item.accession === selected
        return (
          <li key={item.accession}>
            <button
              type="button"
              onClick={() => onSelect(item.accession)}
              aria-current={isSelected ? 'true' : undefined}
              className={`w-full rounded px-2 py-3 text-left hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400 ${
                isSelected ? 'bg-slate-800 ring-1 ring-sky-500' : ''
              }`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {item.name} <span className="text-xs font-normal text-slate-400">{item.accession}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {item.file_count} {item.file_count === 1 ? 'arquivo' : 'arquivos'}
                </span>
              </span>
              {item.title && <span className="mt-0.5 block text-sm text-slate-300">{item.title}</span>}
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-200">
                  {programLabel(item.program)}
                </span>
                <span>{item.project_type ? PROJECT_TYPE_LABELS[item.project_type] : 'Tipo não informado'}</span>
                <span aria-hidden="true">·</span>
                <span>{formatPeriod(item.start_date, item.end_date)}</span>
                <OriginBadge origin={item.origin_category} />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface PaginationProps {
  page: number
  pages: number
  onPage: (page: number) => void
}

function Pagination({ page, pages, onPage }: PaginationProps) {
  return (
    <nav aria-label="Páginas do catálogo" className="flex items-center gap-2 text-sm">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={BUTTON}>
        Anterior
      </button>
      <span className="tabular-nums text-slate-300">
        Página {page} de {pages}
      </span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className={BUTTON}>
        Próxima
      </button>
    </nav>
  )
}

export function InvestigationsCatalog() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const catalog = useInvestigations({
    program: filters.program || undefined,
    project_type: filters.projectType || undefined,
    q: filters.q || undefined,
    page,
    page_size: PAGE_SIZE,
  })

  // Filtro novo sempre volta para a primeira página
  function handleFilters(next: Filters) {
    setFilters(next)
    setPage(1)
  }

  const data = catalog.data
  const synthetic = data?.items.some((item) => item.origin_category === 'Synthetic') ?? false

  return (
    <div className="space-y-4">
      <section aria-labelledby="catalog-title" className={CARD}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="catalog-title" className="text-lg font-semibold">
            Investigações de combustão do PSI
          </h2>
          {data && (
            <p aria-live="polite" className="text-sm text-slate-400">
              {rangeLabel(data.page, data.page_size, data.items.length, data.total)}
              {catalog.isPlaceholderData && ' · atualizando…'}
            </p>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Metadados das investigações do NASA Physical Sciences Informatics. Escolha uma para ver objetivo,
          citação e arquivos.
        </p>
        {synthetic && (
          <p role="note" className="mt-3 rounded border border-sky-700 bg-sky-950/40 px-3 py-2 text-sm text-sky-100">
            <strong>Catálogo de exemplo.</strong> Os códigos PSI-9xxx são sintéticos e não existem no PSI. As
            investigações reais entram quando a ingestão gravar os metadados no banco.
          </p>
        )}
        <div className="mt-4">
          <FilterBar filters={filters} onChange={handleFilters} />
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <section aria-label="Resultados" className={`${CARD} lg:col-span-3`}>
          {catalog.isPending && <p className="text-sm text-slate-400">Carregando catálogo…</p>}
          {catalog.error && !data && (
            <div role="alert" className="rounded border border-red-500 bg-red-950/60 p-3 text-sm text-red-100">
              <p className="font-semibold">{describeError(catalog.error)}</p>
              <p className="mt-1">Não foi possível carregar o catálogo.</p>
              <button type="button" onClick={() => catalog.refetch()} className={`${BUTTON} mt-2`}>
                Tentar de novo
              </button>
            </div>
          )}
          {data && data.items.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma investigação com esses filtros.</p>
          )}
          {data && data.items.length > 0 && (
            <>
              <InvestigationList items={data.items} selected={selected} onSelect={setSelected} />
              <div className="mt-3 flex justify-end">
                <Pagination page={data.page} pages={pageCount(data.total, data.page_size)} onPage={setPage} />
              </div>
            </>
          )}
        </section>

        <div className="lg:sticky lg:top-4 lg:col-span-2">
          {selected ? (
            <InvestigationDetail accession={selected} onClose={() => setSelected(null)} />
          ) : (
            <p className={`${CARD} text-sm text-slate-400`}>Selecione uma investigação para ver o detalhe.</p>
          )}
        </div>
      </div>
    </div>
  )
}
