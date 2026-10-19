import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // fetch do Node exige URL absoluta; os handlers MSW usam */api/v1/...
    env: {
      VITE_API_BASE_URL: 'http://localhost/api/v1',
      VITE_USE_MOCKS: 'true',
    },
  },
})
