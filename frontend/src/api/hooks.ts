import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInvestigation,
  getInvestigations,
  getLatestTelemetry,
  getPredictionReport,
  getSystemMetrics,
  postMcpContext,
  resetSimulation,
  triggerSuppression,
} from './client'
import type { InvestigationQuery } from './types'

export const TELEMETRY_POLL_MS = Number(import.meta.env.VITE_TELEMETRY_POLL_MS ?? 2000)
// Métricas mudam pouco: polling mais espaçado
const METRICS_POLL_MS = 10_000

const TELEMETRY_KEY = ['telemetry', 'latest'] as const

export function useLatestTelemetry() {
  return useQuery({
    queryKey: TELEMETRY_KEY,
    queryFn: getLatestTelemetry,
    refetchInterval: TELEMETRY_POLL_MS,
  })
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: getSystemMetrics,
    refetchInterval: METRICS_POLL_MS,
  })
}

// Arquivo estático: não muda enquanto a página estiver aberta
export function usePredictionReport() {
  return useQuery({
    queryKey: ['predictions'],
    queryFn: () => getPredictionReport(),
    staleTime: Infinity,
  })
}

export function useMcpContext() {
  return useMutation({ mutationFn: postMcpContext })
}

export type SimulationAction = 'suppress' | 'reset'

// A resposta já é a leitura nova: entra direto no cache, sem esperar o próximo polling
export function useSimulationControl() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: SimulationAction) => (action === 'suppress' ? triggerSuppression() : resetSimulation()),
    onSuccess: (telemetry) => queryClient.setQueryData(TELEMETRY_KEY, telemetry),
  })
}

// Catálogo muda só quando a ingestão roda: sem polling. Ao trocar de filtro ou página,
// a lista anterior continua na tela até a nova chegar (sem piscar vazio).
export function useInvestigations(query: InvestigationQuery) {
  return useQuery({
    queryKey: ['investigations', query],
    queryFn: () => getInvestigations(query),
    placeholderData: keepPreviousData,
  })
}

export function useInvestigation(accession: string | null) {
  return useQuery({
    queryKey: ['investigations', accession],
    queryFn: () => getInvestigation(accession ?? ''),
    enabled: accession !== null,
  })
}
