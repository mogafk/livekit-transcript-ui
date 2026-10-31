import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { tokenMatches } from '../src/ingest.ts'
import { SessionStore } from '../src/store.ts'
import { batch, segment } from './helpers.ts'

const TOKEN = 'test-token-0123456789'

function setup() {
  const store = new SessionStore({ idleTimeoutMs: 60_000, retentionMs: 60_000 })
  const app = buildApp(store, TOKEN)
  const post = (body: unknown, auth = `Bearer ${TOKEN}`) =>
    app.inject({
      method: 'POST',
      url: '/api/ingest',
      headers: { authorization: auth, 'content-type': 'application/json' },
      payload: typeof body === 'string' ? body : JSON.stringify(body),
    })
  return { store, app, post }
}

describe('POST /api/ingest', () => {
  it('204 and creates the session from the first batch', async () => {
    const { store, post } = setup()
    const res = await post(batch([segment(5, 'alice:1', 'Hi', true)]))
    expect(res.statusCode).toBe(204)
    expect(store.get('s1')?.segments).toHaveLength(1)
  })

  it('204 for a batch of duplicates only', async () => {
    const { post } = setup()
    const body = batch([segment(1, 'alice:1', 'Hi', true)])
    await post(body)
    expect((await post(body)).statusCode).toBe(204)
  })

  it('401 for a missing or wrong token, even with a broken body', async () => {
    const { store, post } = setup()
    expect((await post(batch([]), '')).statusCode).toBe(401)
    expect((await post('{not json', 'Bearer nope')).statusCode).toBe(401)
    expect(store.list()).toHaveLength(0)
  })

  it('400 for a broken batch: nothing is applied', async () => {
    const { store, post } = setup()
    expect((await post('{not json')).statusCode).toBe(400)
    expect((await post({ ...batch([]), version: 2 })).statusCode).toBe(400)
    const half = batch([segment(1, 'alice:1', 'ok', true), { seq: 2, type: 'segment' }])
    expect((await post(half)).statusCode).toBe(400)
    expect(store.list()).toHaveLength(0)
  })
})

describe('tokenMatches', () => {
  it('compares the whole header', () => {
    expect(tokenMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true)
    expect(tokenMatches(TOKEN, TOKEN)).toBe(false)
    expect(tokenMatches(`Bearer ${TOKEN}x`, TOKEN)).toBe(false)
    expect(tokenMatches(undefined, TOKEN)).toBe(false)
  })
})

describe('SessionStore', () => {
  const T0 = '2026-10-31T12:00:00.000Z'
  const at = (ms: number) => new Date(Date.parse(T0) + ms)
  const info = { id: 's1', name: 'room', startedAt: T0 }
  const ended = { seq: 1, type: 'session_ended' as const, at: T0 }

  it('marks a silent live session idle and notifies subscribers', () => {
    const store = new SessionStore({ idleTimeoutMs: 1000, retentionMs: 60_000 })
    store.ingest({ session: info, events: [] }, at(0))
    const messages: unknown[] = []
    store.subscribeList((m) => messages.push(m))
    store.sweep(at(500))
    expect(store.list()[0]?.status).toBe('live')
    store.sweep(at(1000))
    expect(store.list()[0]).toMatchObject({ status: 'idle', expiresAt: at(60_000).toISOString() })
    expect(messages).toHaveLength(2) // snapshot + idle
  })

  it('removes an ended session after retention and tells both streams', () => {
    const store = new SessionStore({ idleTimeoutMs: 1000, retentionMs: 5000 })
    store.ingest({ session: info, events: [ended] }, at(0))
    expect(store.list()[0]?.expiresAt).toBe(at(5000).toISOString())

    const list: unknown[] = []
    const session: unknown[] = []
    store.subscribeList((m) => list.push(m))
    store.subscribeSession('s1', (m) => session.push(m))
    store.sweep(at(4999))
    expect(store.get('s1')).toBeDefined()
    store.sweep(at(5000))
    expect(store.get('s1')).toBeUndefined()
    expect(list.at(-1)).toEqual({ type: 'session_removed', id: 's1' })
    expect(session.at(-1)).toEqual({ type: 'session_removed' })
  })

  it('keeps a live session however long it lasts', () => {
    const store = new SessionStore({ idleTimeoutMs: 60_000, retentionMs: 5000 })
    store.ingest({ session: info, events: [] }, at(0))
    expect(store.list()[0]?.expiresAt).toBeNull()
    store.sweep(at(30_000))
    expect(store.get('s1')).toBeDefined()
  })
})
