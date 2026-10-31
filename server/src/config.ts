import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const envFile = fileURLToPath(new URL('../../.env', import.meta.url))

const schema = z.object({
  HTTP_SINK_TOKEN: z.string().min(16, 'HTTP_SINK_TOKEN: at least 16 characters, see .env.example'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  SESSION_IDLE_TIMEOUT_S: z.coerce.number().positive().default(300),
})

export type Config = z.infer<typeof schema>

/** Reads .env from the repository root (if any) and the environment; exits on errors. */
export function loadConfig(): Config {
  if (existsSync(envFile)) process.loadEnvFile(envFile)
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    console.error(`Configuration error (.env or environment):\n${z.prettifyError(parsed.error)}`)
    process.exit(2)
  }
  return parsed.data
}
