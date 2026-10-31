// Transcriber protocol v1: https://github.com/mogafk/livekit-transcript/blob/main/docs/http-sink.md.
// Unknown fields are stripped (zod default), unknown event types are kept as `unknown`:
// the protocol allows both without a version bump.
import { z } from 'zod'

const time = z.iso.datetime()

const base = { seq: z.int().positive(), at: time }

const speaker = z.object({ id: z.string().min(1), name: z.string() })

const knownEvents = {
  session_started: z.object({ ...base, type: z.literal('session_started') }),
  session_ended: z.object({ ...base, type: z.literal('session_ended') }),
  speaker_joined: z.object({ ...base, type: z.literal('speaker_joined'), speaker }),
  speaker_left: z.object({ ...base, type: z.literal('speaker_left'), speaker }),
  segment: z.object({
    ...base,
    type: z.literal('segment'),
    segment: z.object({
      segment_id: z.string().min(1),
      speaker_id: z.string().min(1),
      speaker_name: z.string(),
      is_final: z.boolean(),
      start: time,
      end: time,
      text: z.string(),
    }),
  }),
}

type KnownType = keyof typeof knownEvents
export type KnownEvent = z.infer<(typeof knownEvents)[KnownType]>
export type UnknownEvent = { seq: number; type: 'unknown' }
export type ProtocolEvent = KnownEvent | UnknownEvent

const rawEvent = z.looseObject({ ...base, type: z.string() })

const batchSchema = z.object({
  version: z.literal(1),
  session: z.object({ id: z.string().min(1), name: z.string(), started_at: time }),
  events: z.array(rawEvent),
})

export interface Batch {
  session: { id: string; name: string; startedAt: string }
  events: ProtocolEvent[]
}

export type ParseResult = { ok: true; batch: Batch } | { ok: false; error: string }

/** Validates the whole batch before anything is applied: an invalid batch is a 400. */
export function parseBatch(body: unknown): ParseResult {
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }

  const events: ProtocolEvent[] = []
  for (const [i, raw] of parsed.data.events.entries()) {
    if (!Object.hasOwn(knownEvents, raw.type)) {
      events.push({ seq: raw.seq, type: 'unknown' })
      continue
    }
    const event = knownEvents[raw.type as KnownType].safeParse(raw)
    if (!event.success) {
      return { ok: false, error: `events[${i}] (${raw.type}): ${z.prettifyError(event.error)}` }
    }
    events.push(event.data)
  }

  const { id, name, started_at } = parsed.data.session
  return { ok: true, batch: { session: { id, name, startedAt: started_at }, events } }
}
