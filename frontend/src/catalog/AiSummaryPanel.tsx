// Resumo por IA de uma investigação (POST /ai/summarize). Só pede quando a pessoa
// clica: cada pedido pode gastar cota do provedor. O texto original do PSI fica logo
// abaixo, no detalhe, e o selo de origem deixa claro que o resumo não é dado da NASA.
import { useState } from 'react'
import { ApiError, describeError } from '../api/client'
import { useAiSummary } from '../api/hooks'
import type { AiSummary } from '../api/types'
import { OriginBadge } from './OriginBadge'

const SOURCE_FIELD_LABELS: Record<AiSummary['source_fields'][number], string> = {
  objective: 'Objetivo',
  approach: 'Abordagem',
  hypothesis: 'Hipótese',
}

const GENERATED_AT_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Explica o que fazer, além do título curto do erro
function errorHint(error: Error): string {
  if (error instanceof ApiError && error.code === 'NO_SOURCE_TEXT') {
    return 'O PSI não traz objetivo, abordagem nem hipótese desta investigação: não há o que resumir sem inventar.'
  }
  if (error instanceof ApiError && error.code === 'SERVICE_UNAVAILABLE') {
    return 'O provedor de IA não está configurado ou não respondeu. Os textos originais do PSI continuam abaixo.'
  }
  return 'Não foi possível gerar o resumo agora.'
}

function SummaryBody({ summary }: { summary: AiSummary }) {
  const fields = summary.source_fields.map((field) => SOURCE_FIELD_LABELS[field]).join(', ')
  const generatedAt = GENERATED_AT_FORMAT.format(new Date(summary.generated_at))
  return (
    <div className="mt-2">
      <p className="text-sm whitespace-pre-line text-slate-100">{summary.summary}</p>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <OriginBadge origin={summary.origin_category} />
        <span>Baseado em: {fields}</span>
        <span aria-hidden="true">·</span>
        <span>{summary.model ? `Modelo ${summary.model}` : 'Sem modelo de IA'}</span>
        <span aria-hidden="true">·</span>
        <span>Gerado em {generatedAt}</span>
      </p>
    </div>
  )
}

export function AiSummaryPanel({ accession }: { accession: string }) {
  const [requested, setRequested] = useState(false)
  const summary = useAiSummary(accession, requested)

  return (
    <section aria-labelledby="ai-summary-title" className="rounded border border-amber-700/60 bg-amber-950/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="ai-summary-title" className="text-xs font-medium uppercase tracking-wide text-amber-200">
          Resumo por IA
        </h3>
        {!requested && (
          <button
            type="button"
            onClick={() => setRequested(true)}
            className="rounded border border-amber-600 px-2 py-1 text-sm text-amber-100 hover:bg-amber-900/40 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            Gerar resumo
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Reformula só os textos do PSI abaixo, sem acrescentar conclusões. Não é dado da NASA: confira sempre o
        original.
      </p>

      {summary.isFetching && <p className="mt-2 text-sm text-slate-400">Gerando resumo…</p>}
      {summary.error && !summary.isFetching && (
        <div role="alert" className="mt-2 rounded border border-red-500 bg-red-950/60 p-3 text-sm text-red-100">
          <p className="font-semibold">{describeError(summary.error)}</p>
          <p className="mt-1">{errorHint(summary.error)}</p>
          <button
            type="button"
            onClick={() => void summary.refetch()}
            className="mt-2 rounded border border-red-400 px-2 py-1 text-xs hover:bg-red-900/50 focus-visible:outline-2 focus-visible:outline-red-300"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {summary.data && <SummaryBody summary={summary.data} />}
    </section>
  )
}
