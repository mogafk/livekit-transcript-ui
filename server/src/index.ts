import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { SessionStore } from './store.ts'

const SWEEP_MS = 5_000

const config = loadConfig()
const store = new SessionStore(config.SESSION_IDLE_TIMEOUT_S * 1000)
const app = buildApp(store, config.HTTP_SINK_TOKEN, { logger: { level: 'info' } })

setInterval(() => store.sweep(), SWEEP_MS).unref()

await app.listen({ host: config.HOST, port: config.PORT })
app.log.info(`transcriber: HTTP_SINK_URL=http://localhost:${config.PORT}/api/ingest`)
