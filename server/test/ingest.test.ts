import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { tokenMatches } from '../src/ingest.ts'
import { SessionStore } from '../src/store.ts'
import { batch, segment } from './helpers.ts'

const TOKEN = 'test-token-0123456789'

function setup() {
  const store = new SessionStore(60_000)
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
  it('marks a silent live session idle and notifies subscribers', () => {
    const store = new SessionStore(1000)
    store.ingest(
      {
        session: { id: 's1', name: 'room', startedAt: '2026-10-31T12:00:00.000Z' },
        events: [],
      },
      new Date('2026-10-31T12:00:00.000Z'),
    )
    const messages: unknown[] = []
    store.subscribeList((m) => messages.push(m))
    store.sweep(new Date('2026-10-31T12:00:00.500Z'))
    expect(store.list()[0]?.status).toBe('live')
    store.sweep(new Date('2026-10-31T12:00:01.000Z'))
    expect(store.list()[0]?.status).toBe('idle')
    expect(messages).toHaveLength(2) // snapshot + idle
  })
})
