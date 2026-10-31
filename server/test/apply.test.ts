import { describe, expect, it } from 'vitest'
import { applyBatch, createSession, sortSegments, type SessionState } from '../src/apply.ts'
import { parseBatch, type ProtocolEvent } from '../src/protocol.ts'
import { batch, segment, speakerEvent } from './helpers.ts'

const NOW = '2026-10-31T12:00:00.000Z'

function session(): SessionState {
  return createSession({ id: 's1', name: 'room', startedAt: NOW }, NOW)
}

function events(...raw: object[]): ProtocolEvent[] {
  const result = parseBatch(batch(raw))
  if (!result.ok) throw new Error(result.error)
  return result.batch.events
}

describe('applyBatch', () => {
  it('replaces interim versions and keeps the final', () => {
    const s = session()
    applyBatch(s, events(segment(1, 'alice:1', 'Hi', false)), NOW)
    applyBatch(s, events(segment(2, 'alice:1', 'Hi, Bob', false)), NOW)
    applyBatch(s, events(segment(3, 'alice:1', 'Hi, Bob. Hear me?', true)), NOW)
    expect([...s.segments.values()]).toMatchObject([{ text: 'Hi, Bob. Hear me?', isFinal: true }])
  })

  it('ignores anything for a segment after its final', () => {
    const s = session()
    applyBatch(s, events(segment(1, 'alice:1', 'Final', true)), NOW)
    const changes = applyBatch(s, events(segment(2, 'alice:1', 'Late interim', false)), NOW)
    expect(s.segments.get('alice:1')?.text).toBe('Final')
    expect(changes).toEqual([])
  })

  it('skips duplicates by seq, gaps are fine', () => {
    const s = session()
    applyBatch(s, events(segment(1, 'alice:1', 'one', true), segment(5, 'bob:1', 'two', true)), NOW)
    const changes = applyBatch(
      s,
      events(segment(5, 'bob:1', 'dup', false), segment(7, 'bob:2', 'three', true)),
      NOW,
    )
    expect(s.lastSeq).toBe(7)
    expect(s.segments.get('bob:1')?.text).toBe('two')
    expect(changes.filter((c) => c.type === 'segment')).toHaveLength(1)
  })

  it('an empty final removes the shown interim', () => {
    const s = session()
    applyBatch(s, events(segment(1, 'alice:1', 'uh', false)), NOW)
    const changes = applyBatch(s, events(segment(2, 'alice:1', '', true)), NOW)
    expect(s.segments.size).toBe(0)
    expect(changes).toContainEqual({ type: 'segment_removed', id: 'alice:1' })
    // ...and later versions do not bring it back.
    applyBatch(s, events(segment(3, 'alice:1', 'uh', false)), NOW)
    expect(s.segments.size).toBe(0)
  })

  it('an empty final without interim changes nothing', () => {
    const s = session()
    const changes = applyBatch(s, events(segment(1, 'alice:1', '', true)), NOW)
    expect(s.segments.size).toBe(0)
    expect(changes.some((c) => c.type === 'segment_removed')).toBe(false)
  })

  it('tracks speakers; a rejoin is the same speaker', () => {
    const s = session()
    applyBatch(s, events(speakerEvent(1, 'speaker_joined', 'alice')), NOW)
    applyBatch(s, events(speakerEvent(2, 'speaker_left', 'alice')), NOW)
    expect(s.speakers.get('alice')?.present).toBe(false)
    applyBatch(s, events(speakerEvent(3, 'speaker_joined', 'alice')), NOW)
    expect([...s.speakers.values()]).toEqual([{ id: 'alice', name: 'Alice', present: true }])
  })

  it('adds the speaker of a segment whose speaker_joined was lost', () => {
    const s = session()
    applyBatch(s, events(segment(9, 'bob:1', 'Yes', true, 'bob')), NOW)
    expect(s.speakers.get('bob')).toEqual({ id: 'bob', name: 'Bob', present: true })
  })

  it('session_ended ends; an idle session goes live on a new batch', () => {
    const s = session()
    s.status = 'idle'
    applyBatch(s, events(segment(1, 'alice:1', 'Hi', true)), NOW)
    expect(s.status).toBe('live')
    applyBatch(s, events({ seq: 2, type: 'session_ended', at: NOW }), NOW)
    expect(s.status).toBe('ended')
  })

  it('ignores unknown event types but advances seq', () => {
    const s = session()
    applyBatch(s, events({ seq: 4, type: 'from_the_future', at: NOW, extra: 1 }), NOW)
    expect(s.lastSeq).toBe(4)
  })
})

describe('parseBatch', () => {
  it('accepts unknown fields', () => {
    const raw = batch([{ ...segment(1, 'a:1', 'x', true), extra: true }])
    expect(parseBatch({ ...raw, extra: 1 }).ok).toBe(true)
  })

  it('rejects another version and broken known events', () => {
    expect(parseBatch({ ...batch([]), version: 2 }).ok).toBe(false)
    expect(parseBatch(batch([{ seq: 1, type: 'segment', at: NOW }])).ok).toBe(false)
  })
})

describe('sortSegments', () => {
  it('orders by start', () => {
    const seg = (id: string, start: string) =>
      ({ id, start, end: start, speakerId: '', speakerName: '', text: '', isFinal: true }) as const
    const sorted = sortSegments([
      seg('b', '2026-10-31T12:00:02.000Z'),
      seg('a', '2026-10-31T12:00:01.000Z'),
    ])
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b'])
  })
})
