// REST and SSE for the UI.
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { SessionStore } from './store.ts'

const HEARTBEAT_MS = 15_000

export function registerApi(app: FastifyInstance, store: SessionStore): void {
  app.get('/api/sessions', async () => store.list())

  app.get<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const detail = store.get(request.params.id)
    return detail ?? reply.code(404).send({ error: 'no such session' })
  })

  app.get('/api/sessions/events', (_request, reply) => {
    openStream(reply, (send) => store.subscribeList(send))
  })

  app.get<{ Params: { id: string } }>('/api/sessions/:id/events', (request, reply) => {
    if (!store.get(request.params.id)) {
      return reply.code(404).send({ error: 'no such session' })
    }
    openStream(reply, (send) => store.subscribeSession(request.params.id, send) ?? (() => {}))
  })
}

/** Takes the response over from Fastify and writes SSE until the client goes away. */
function openStream(
  reply: FastifyReply,
  subscribe: (send: (message: unknown) => void) => () => void,
): void {
  reply.hijack()
  const res = reply.raw
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  const unsubscribe = subscribe((message) => res.write(`data: ${JSON.stringify(message)}\n\n`))
  // Keeps proxies from closing an idle stream.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
  res.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
}
