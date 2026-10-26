import { z } from 'zod'

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true')

const envSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('hRango'),
  VITE_API_BASE_URL: z.string().min(1).default('/api'),
  VITE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  VITE_ENABLE_MOCKS: booleanString.default(true),
  VITE_MOCK_LATENCY_MS: z.coerce.number().int().min(0).default(400),
  VITE_ENABLE_DEVTOOLS: booleanString.default(false),
  MODE: z.string(),
  DEV: z.boolean(),
  PROD: z.boolean(),
  BASE_URL: z.string(),
})

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  const result = envSchema.safeParse(import.meta.env)
  if (!result.success) {
    // Fail fast with a readable list instead of a vague runtime error later.
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

/**
 * Typed, validated view of `import.meta.env`.
 * Add new keys to `envSchema`, `src/vite-env.d.ts` and `.env.example` together.
 */
export const env: Env = parseEnv()

/** `true` when the API is the in-browser mock (MSW), not a real backend. */
export const isMockApi = env.VITE_ENABLE_MOCKS
