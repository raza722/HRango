/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_TIMEOUT_MS?: string
  readonly VITE_ENABLE_MOCKS?: 'true' | 'false'
  readonly VITE_MOCK_LATENCY_MS?: string
  readonly VITE_ENABLE_DEVTOOLS?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
