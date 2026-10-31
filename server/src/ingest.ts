// POST /api/ingest — events from the transcriber. Response codes drive its retries:
// 401/5xx — the same batch again, 400 — the batch is dropped. So 400 only for a batch
// that is really broken; any error of ours stays 5xx (Fastify's default).
import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { parseBatch } from './protocol.ts'
import type { SessionStore } from './store.ts'

const sha256 = (value: string) => createHash('sha256').update(value).digest()

/** Constant time; hashes have the same length, so the token length does not leak either. */
export function tokenMatches(header: string | undefined, token: string): boolean {
  return timingSafeEqual(sha256(header ?? ''), sha256(`Bearer ${token}`))
}

export function registerIngest(app: FastifyInstance, store: SessionStore, token: string): void {
  app.post(
    '/api/ingest',
    {
      // Before the body is read: a bad token is a 401 even for a broken body.
      onRequest: async (request, reply) => {
        if (!tokenMatches(request.headers.authorization, token)) {
          request.log.warn('ingest: bad token')
          return reply.code(401).send({ error: 'bad token' })
        }
      },
    },
    async (request, reply) => {
      const result = parseBatch(request.body)
      if (!result.ok) {
        request.log.error(
          { error: result.error },
          'ingest: invalid batch, the transcriber drops it',
        )
        return reply.code(400).send({ error: result.error })
      }
      store.ingest(result.batch)
      return reply.code(204).send()
    },
  )
}
