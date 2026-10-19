import { useMutation, useQuery } from '@tanstack/react-query'
import { getLatestTelemetry, postMcpContext } from './client'

const TELEMETRY_POLL_MS = Number(import.meta.env.VITE_TELEMETRY_POLL_MS ?? 2000)

export function useLatestTelemetry() {
  return useQuery({
    queryKey: ['telemetry', 'latest'],
    queryFn: getLatestTelemetry,
    refetchInterval: TELEMETRY_POLL_MS,
  })
}

export function useMcpContext() {
  return useMutation({ mutationFn: postMcpContext })
}
