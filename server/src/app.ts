import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import fastifyStatic from '@fastify/static'
import Fastify, { LogController, type FastifyServerOptions } from 'fastify'
import { registerApi } from './api.ts'
import { registerIngest } from './ingest.ts'
import type { SessionStore } from './store.ts'

const uiDist = fileURLToPath(new URL('../../ui/dist', import.meta.url))

export function buildApp(store: SessionStore, token: string, options: FastifyServerOptions = {}) {
  // The transcriber posts a batch per phrase: request logs would be noise.
  const logController = new LogController({ disableRequestLogging: true })
  const app = Fastify({ logController, ...options })
  registerIngest(app, store, token)
  registerApi(app, store)

  // In dev the UI is served by Vite; after `npm run build` — by us.
  if (existsSync(uiDist)) {
    app.register(fastifyStatic, { root: uiDist })
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html') // SPA routes
      }
      return reply.code(404).send({ error: 'not found' })
    })
  }
  return app
}
