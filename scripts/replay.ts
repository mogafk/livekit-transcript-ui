// Fake transcriber: plays a two-speaker call by the protocol of
// https://github.com/mogafk/livekit-transcript/blob/main/docs/http-sink.md
// with the cases the server must handle: interim → final, a gap in seq, a retried (duplicate) batch, an empty final, a rejoin.
//
//   npm run replay                       # to http://localhost:$PORT/api/ingest, token from .env
//   npm run replay -- --speed 4 --no-end # faster, leave the session live
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { parseArgs } from 'node:util'

if (existsSync('.env')) process.loadEnvFile('.env')

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: `http://localhost:${process.env.PORT ?? 8787}/api/ingest` },
    token: { type: 'string', default: process.env.HTTP_SINK_TOKEN ?? '' },
    room: { type: 'string', default: 'replay-room' },
    speed: { type: 'string', default: '1' },
    'no-end': { type: 'boolean', default: false },
  },
})

const speed = Number(args.speed)
const session = { id: randomUUID(), name: args.room, started_at: new Date().toISOString() }
const names: Record<string, string> = { alice: 'Alice', bob: 'Bob' }
const phraseNo: Record<string, number> = {}
let seq = 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms / speed))
const now = () => new Date().toISOString()

async function send(events: object[]): Promise<void> {
  const res = await fetch(args.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ version: 1, session, events }),
  })
  const seqs = events.map((e) => (e as { seq: number }).seq).join(',')
  console.log(`seq ${seqs} → ${res.status}${res.ok ? '' : ` ${await res.text()}`}`)
  if (!res.ok) process.exit(1)
}

const event = (type: string, extra: object = {}) => ({ seq: ++seq, type, at: now(), ...extra })
const speakerEvent = (type: string, id: string) => event(type, { speaker: { id, name: names[id] } })

/** Says a phrase word by word: interim versions, then the final. */
async function say(speaker: string, text: string, opts: { emptyFinal?: boolean } = {}) {
  const id = `${speaker}:${(phraseNo[speaker] = (phraseNo[speaker] ?? 0) + 1)}`
  const start = now()
  const words = text.split(' ')
  const segment = (partial: string, isFinal: boolean) =>
    event('segment', {
      segment: {
        segment_id: id,
        speaker_id: speaker,
        speaker_name: names[speaker],
        is_final: isFinal,
        start,
        end: now(),
        text: partial,
      },
    })

  for (let i = 1; i < words.length; i++) {
    await sleep(350)
    if (i % 3 === 0) seq++ // an interim superseded before sending: a gap in seq
    await send([segment(words.slice(0, i).join(' '), false)])
  }
  await sleep(500)
  await send([segment(opts.emptyFinal ? '' : text, true)])
  await sleep(600)
}

console.log(`session ${session.id} (${session.name}) → ${args.url}`)

const opening = [
  event('session_started'),
  speakerEvent('speaker_joined', 'alice'),
  speakerEvent('speaker_joined', 'bob'),
]
await send(opening)
await send(opening) // the response "was lost": the same batch again, all duplicates

await say('alice', 'Hi Bob, can you hear me?')
await say('bob', 'Yes, loud and clear. How was the trip?')
await say('alice', 'Hmm', { emptyFinal: true }) // not speech: the interim disappears
await say('alice', 'Great, but the flight was delayed by two hours.')
await send([speakerEvent('speaker_left', 'bob')])
await sleep(1500)
await send([speakerEvent('speaker_joined', 'bob')])
await say('bob', 'Sorry, my connection dropped. Two hours, you said?')
await say('alice', 'Yes, we can talk about it later. Let us start the meeting.')

if (!args['no-end']) {
  await send([
    speakerEvent('speaker_left', 'alice'),
    speakerEvent('speaker_left', 'bob'),
    event('session_ended'),
  ])
}
