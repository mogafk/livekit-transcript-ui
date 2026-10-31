// Protocol rules: duplicates, segment versions, finalization. No I/O — everything is
// tested here. The session is mutated in place, the returned changes go to the UI.
import type {
  Segment,
  SessionChange,
  SessionStatus,
  SessionSummary,
  Speaker,
} from '@transcript-ui/shared'
import type { Batch, ProtocolEvent } from './protocol.ts'

export interface SessionState {
  id: string
  name: string
  startedAt: string
  status: SessionStatus
  lastSeq: number
  lastEventAt: string
  speakers: Map<string, Speaker>
  segments: Map<string, Segment>
  /** segment_id of finals, including empty ones: later versions are ignored. */
  finalized: Set<string>
}

export function createSession(info: Batch['session'], now: string): SessionState {
  return {
    ...info,
    status: 'live',
    lastSeq: 0,
    lastEventAt: now,
    speakers: new Map(),
    segments: new Map(),
    finalized: new Set(),
  }
}

export function summarize(s: SessionState): SessionSummary {
  return {
    id: s.id,
    name: s.name,
    startedAt: s.startedAt,
    status: s.status,
    lastEventAt: s.lastEventAt,
    speakerCount: s.speakers.size,
    segmentCount: s.segments.size,
  }
}

/** Applies a batch. Always ends with a `session` change: lastEventAt and counters move. */
export function applyBatch(s: SessionState, events: ProtocolEvent[], now: string): SessionChange[] {
  const changes: SessionChange[] = []
  s.lastEventAt = now
  if (s.status === 'idle') s.status = 'live'

  for (const event of events) {
    if (event.seq <= s.lastSeq) continue // duplicate of a retried batch
    s.lastSeq = event.seq
    applyEvent(s, event, changes)
  }

  changes.push({ type: 'session', session: summarize(s) })
  return changes
}

function applyEvent(s: SessionState, event: ProtocolEvent, changes: SessionChange[]): void {
  switch (event.type) {
    case 'session_started':
      return
    case 'session_ended':
      s.status = 'ended'
      return
    case 'speaker_joined':
    case 'speaker_left':
      setSpeaker(s, event.speaker.id, event.speaker.name, event.type === 'speaker_joined', changes)
      return
    case 'segment': {
      const seg = event.segment
      if (s.finalized.has(seg.segment_id)) return // the final is final
      // Its speaker_joined may be lost or received before a server restart.
      if (!s.speakers.has(seg.speaker_id)) {
        setSpeaker(s, seg.speaker_id, seg.speaker_name, true, changes)
      }
      if (seg.is_final) s.finalized.add(seg.segment_id)

      if (seg.is_final && seg.text === '') {
        // Not speech after all: remove its interim version if it was shown.
        if (s.segments.delete(seg.segment_id)) {
          changes.push({ type: 'segment_removed', id: seg.segment_id })
        }
        return
      }
      const segment: Segment = {
        id: seg.segment_id,
        speakerId: seg.speaker_id,
        speakerName: seg.speaker_name,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        isFinal: seg.is_final,
      }
      s.segments.set(segment.id, segment)
      changes.push({ type: 'segment', segment })
      return
    }
    case 'unknown':
      return
  }
}

function setSpeaker(
  s: SessionState,
  id: string,
  name: string,
  present: boolean,
  changes: SessionChange[],
): void {
  const speaker: Speaker = { id, name, present }
  s.speakers.set(id, speaker)
  changes.push({ type: 'speaker', speaker })
}

/** Segments in display order: by start, ties — by id for a stable order. */
export function sortSegments(segments: Iterable<Segment>): Segment[] {
  return [...segments].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}
