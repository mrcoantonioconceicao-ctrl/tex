import { useMutation, useQuery } from '@tanstack/react-query'
import { getLatestTelemetry, getSystemMetrics, postMcpContext } from './client'

export const TELEMETRY_POLL_MS = Number(import.meta.env.VITE_TELEMETRY_POLL_MS ?? 2000)
// Métricas mudam pouco (no backend atual são fixas): polling mais espaçado
const METRICS_POLL_MS = 10_000

export function useLatestTelemetry() {
  return useQuery({
    queryKey: ['telemetry', 'latest'],
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

export function useMcpContext() {
  return useMutation({ mutationFn: postMcpContext })
}
