import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must run before the React plugin. Paths and code style come from tsr.config.json,
    // which `npm run routes:generate` (the CLI) reads too.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // MSW and its URL / cookie libraries (tldts alone is ~250 kB). Only the on-demand
            // mock server imports them, so they load beside it, as a chunk of their own.
            {
              name: 'msw',
              test: /node_modules[\\/](msw|@mswjs|@msw|@open-draft|tldts|tldts-core|tough-cookie|rettime|outvariant|cookie|is-node-process|until-async)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5190,
    strictPort: true,
  },
  preview: {
    port: 5191,
    strictPort: true,
  },
})
