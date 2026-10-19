/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCKS?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_TELEMETRY_POLL_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
