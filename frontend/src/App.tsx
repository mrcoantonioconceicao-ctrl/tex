// Casca do painel: cabeçalho e duas abas. O catálogo do PSI é o centro do desafio
// (docs/conhecimento/enunciado.md); a simulação de monitoramento é contexto.
// A aba fica na URL (?tela=simulacao) para dar para compartilhar o link.
import { useState, type MouseEvent } from 'react'
import texLogo from './assets/texlabs.jpeg'
import { InvestigationsCatalog } from './catalog/InvestigationsCatalog'
import { MonitoringView } from './dashboard/MonitoringView'
import { ScenarioPicker } from './dashboard/panels'

const usingMocks = import.meta.env.VITE_USE_MOCKS === 'true'
const dataSource = usingMocks ? 'mock (MSW)' : 'backend Axum'

type View = 'catalogo' | 'simulacao'

const VIEWS: { id: View; label: string }[] = [
  { id: 'catalogo', label: 'Investigações do PSI' },
  { id: 'simulacao', label: 'Simulação de monitoramento' },
]

function viewFromUrl(): View {
  return new URLSearchParams(window.location.search).get('tela') === 'simulacao' ? 'simulacao' : 'catalogo'
}

function hrefFor(view: View): string {
  const params = new URLSearchParams(window.location.search)
  if (view === 'catalogo') params.delete('tela')
  else params.set('tela', view)
  const search = params.toString()
  return search ? `?${search}` : window.location.pathname
}

function App() {
  const [view, setView] = useState<View>(viewFromUrl)

  // Link de verdade (abre em nova aba com o botão do meio); clique normal troca sem recarregar
  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, next: View) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    window.history.replaceState(null, '', hrefFor(next))
    setView(next)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* A arte original tem muita margem preta: o span recorta só o oval do logo.
                alt vazio porque o título ao lado já diz "Tex Labs". */}
            <span className="block h-[49px] w-[72px] shrink-0 overflow-hidden rounded-[50%]">
              <img src={texLogo} alt="" className="-mt-[11px] -ml-[30px] h-[72px] w-[132px] max-w-none" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold">Tex Labs: segurança contra incêndio em microgravidade</h1>
              <p className="text-sm text-slate-400">Fonte de dados: {dataSource}</p>
            </div>
          </div>
          {usingMocks && <ScenarioPicker />}
        </header>

        <nav aria-label="Seções do painel" className="flex flex-wrap gap-2 border-b border-slate-800">
          {VIEWS.map(({ id, label }) => {
            const active = id === view
            return (
              <a
                key={id}
                href={hrefFor(id)}
                onClick={(event) => handleNavigate(event, id)}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-400 ${
                  active
                    ? 'border-sky-400 font-semibold text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </a>
            )
          })}
        </nav>

        {view === 'catalogo' ? <InvestigationsCatalog /> : <MonitoringView usingMocks={usingMocks} />}
      </main>
    </div>
  )
}

export default App
