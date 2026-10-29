// Detalhe de uma investigação: textos do PSI sem edição, citação e arquivos.
import { describeError } from '../api/client'
import { useInvestigation } from '../api/hooks'
import type { Investigation, InvestigationFile, OriginCategory } from '../api/types'
import { formatBytes, formatPeriod, PROJECT_TYPE_LABELS, programLabel } from './model'

const CARD = 'rounded-lg border border-slate-700 bg-slate-900 p-4'

// Linhagem sempre visível: mock nunca pode parecer dado do PSI
export function OriginBadge({ origin }: { origin: OriginCategory }) {
  const synthetic = origin === 'Synthetic'
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${
        synthetic ? 'border-sky-600 text-sky-200' : 'border-emerald-600 text-emerald-200'
      }`}
    >
      {synthetic ? 'sintético' : origin === 'Published' ? 'publicado · PSI' : origin}
    </span>
  )
}

function SourceText({ label, text }: { label: string; text: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm whitespace-pre-line ${text === null ? 'text-slate-500 italic' : ''}`}>
        {text ?? 'Não informado pelo PSI'}
      </dd>
    </div>
  )
}

function Missing({ children }: { children: string }) {
  return <span className="text-slate-500 italic">{children}</span>
}

// DOI no formato 10.xxxx/... vira link; qualquer outro texto aparece como veio
function DoiValue({ doi }: { doi: string | null }) {
  if (doi === null) return <Missing>não informado</Missing>
  if (!doi.startsWith('10.')) return <span>{doi}</span>
  return (
    <a
      href={`https://doi.org/${doi}`}
      target="_blank"
      rel="noreferrer"
      className="text-sky-300 underline hover:text-sky-200"
    >
      {doi}
    </a>
  )
}

function FileStatus({ file }: { file: InvestigationFile }) {
  if (file.sha256 === null) return <span className="text-slate-400">não baixado</span>
  return (
    <span className="text-emerald-300" title={`SHA-256 ${file.sha256}`}>
      <span aria-hidden="true">✓ </span>baixado e conferido
    </span>
  )
}

function FilesTable({ files }: { files: InvestigationFile[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-slate-500 italic">Nenhum arquivo de tabela experimental nesta investigação.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Arquivos da investigação</caption>
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">Arquivo</th>
            <th scope="col" className="py-1 pr-3 font-medium">Tamanho</th>
            <th scope="col" className="py-1 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.file_name} className="border-t border-slate-800">
              <td className="py-1.5 pr-3 break-all">{file.file_name}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{formatBytes(file.file_bytes)}</td>
              <td className="py-1.5 whitespace-nowrap">
                <FileStatus file={file} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailBody({ investigation }: { investigation: Investigation }) {
  const projectType = investigation.project_type
    ? PROJECT_TYPE_LABELS[investigation.project_type]
    : 'Tipo não informado'
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="rounded border border-slate-600 px-1.5 py-0.5">{programLabel(investigation.program)}</span>
        <span>{projectType}</span>
        <span aria-hidden="true">·</span>
        <span>{formatPeriod(investigation.start_date, investigation.end_date)}</span>
        <OriginBadge origin={investigation.origin_category} />
      </div>
      {investigation.title && <p className="mt-2 text-sm text-slate-200">{investigation.title}</p>}

      <dl className="mt-4 space-y-3">
        <SourceText label="Objetivo" text={investigation.objective} />
        <SourceText label="Abordagem" text={investigation.approach} />
        <SourceText label="Hipótese" text={investigation.hypothesis} />
      </dl>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Hardware</dt>
          <dd className="mt-1">
            {investigation.hardware.length > 0 ? investigation.hardware.join(', ') : <Missing>não informado</Missing>}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Área</dt>
          <dd className="mt-1">{investigation.sub_research_area ?? <Missing>não informada</Missing>}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">DOI (citação)</dt>
          <dd className="mt-1 break-all">
            <DoiValue doi={investigation.doi} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Licença</dt>
          <dd className="mt-1">{investigation.license ?? <Missing>não informada</Missing>}</dd>
        </div>
      </dl>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400">
        Arquivos ({formatBytes(investigation.total_file_bytes)} no total)
      </h3>
      <div className="mt-2">
        <FilesTable files={investigation.files} />
      </div>
    </>
  )
}

interface InvestigationDetailProps {
  accession: string
  onClose: () => void
}

export function InvestigationDetail({ accession, onClose }: InvestigationDetailProps) {
  const detail = useInvestigation(accession)
  const heading = detail.data ? `${detail.data.name} (${detail.data.accession})` : accession

  return (
    <section aria-labelledby="investigation-detail-title" className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <h2 id="investigation-detail-title" className="text-lg font-semibold">
          {heading}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-600 px-2 py-1 text-sm hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          Fechar<span className="sr-only"> detalhe de {accession}</span>
        </button>
      </div>

      {detail.isPending && <p className="mt-3 text-sm text-slate-400">Carregando investigação…</p>}
      {detail.error && (
        <div role="alert" className="mt-3 rounded border border-red-500 bg-red-950/60 p-3 text-sm text-red-100">
          <p className="font-semibold">{describeError(detail.error)}</p>
          <p className="mt-1">Não foi possível carregar {accession}.</p>
        </div>
      )}
      {detail.data && (
        <div className="mt-3">
          <DetailBody investigation={detail.data} />
        </div>
      )}
    </section>
  )
}
