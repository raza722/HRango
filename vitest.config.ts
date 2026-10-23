import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      restoreMocks: true,
      // Whole-app flows (renderApp + many clicks) can pass 5s when every file runs in parallel.
      testTimeout: 15_000,
      env: {
        VITE_ENABLE_MOCKS: 'true',
        VITE_MOCK_LATENCY_MS: '0',
        VITE_ENABLE_DEVTOOLS: 'false',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/routeTree.gen.ts', 'src/components/ui/**', 'src/mocks/**', 'src/test/**'],
      },
    },
  }),
)
