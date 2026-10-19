import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetSimulation } from '../mocks/handlers'
import { server } from '../mocks/node'
import { DEFAULT_SCENARIO, setMockScenario } from '../mocks/scenario'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  setMockScenario(DEFAULT_SCENARIO)
  resetSimulation()
})
afterAll(() => server.close())
