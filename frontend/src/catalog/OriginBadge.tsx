// Linhagem sempre visível: mock nunca pode parecer dado do PSI, e resumo de IA
// nunca pode parecer texto da fonte
import type { OriginCategory } from '../api/types'

const STYLES: Partial<Record<OriginCategory, { label: string; className: string }>> = {
  Synthetic: { label: 'sintético', className: 'border-sky-600 text-sky-200' },
  Published: { label: 'publicado · PSI', className: 'border-emerald-600 text-emerald-200' },
  Inferred: { label: 'inferido · IA', className: 'border-amber-500 text-amber-200' },
}

export function OriginBadge({ origin }: { origin: OriginCategory }) {
  const style = STYLES[origin] ?? { label: origin, className: 'border-emerald-600 text-emerald-200' }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${style.className}`}>
      {style.label}
    </span>
  )
}
