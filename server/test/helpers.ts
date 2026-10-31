// Raw protocol messages as the transcriber sends them.
const AT = '2026-10-31T12:34:24.197Z'

const names: Record<string, string> = { alice: 'Alice', bob: 'Bob' }

export function batch(events: object[], sessionId = 's1') {
  return { version: 1, session: { id: sessionId, name: 'room', started_at: AT }, events }
}

export function segment(
  seq: number,
  id: string,
  text: string,
  isFinal: boolean,
  speaker = 'alice',
) {
  return {
    seq,
    type: 'segment',
    at: AT,
    segment: {
      segment_id: id,
      speaker_id: speaker,
      speaker_name: names[speaker] ?? speaker,
      is_final: isFinal,
      start: AT,
      end: AT,
      text,
    },
  }
}

export function speakerEvent(seq: number, type: 'speaker_joined' | 'speaker_left', id: string) {
  return { seq, type, at: AT, speaker: { id, name: names[id] ?? id } }
}
