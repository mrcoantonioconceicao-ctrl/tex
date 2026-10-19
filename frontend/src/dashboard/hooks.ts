import { useEffect, useState } from 'react'
import type { CombustionTelemetry } from '../api/types'
import { appendReading, toReading, type Reading } from './model'

// Relógio para recalcular "atualizado há X s" e detectar dado velho
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// O backend só devolve a última leitura: o histórico é montado no cliente,
// uma entrada por resposta (dataUpdatedAt muda a cada polling bem-sucedido).
export function useTelemetryHistory(data: CombustionTelemetry | undefined, updatedAt: number): Reading[] {
  const [state, setState] = useState<{ updatedAt: number; history: Reading[] }>({
    updatedAt: 0,
    history: [],
  })
  // Ajuste durante o render (padrão do React para estado derivado), sem efeito extra
  if (data && updatedAt !== state.updatedAt) {
    setState({ updatedAt, history: appendReading(state.history, toReading(data, updatedAt)) })
  }
  return state.history
}
