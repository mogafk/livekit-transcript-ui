// Messages server → UI. Our own format: the UI knows nothing about seq, duplicates
// and finalization rules of the transcriber protocol.

/** `idle` — no events for SESSION_IDLE_TIMEOUT_S: the transcriber crashed or the call is silent. */
export type SessionStatus = 'live' | 'ended' | 'idle'

export interface SessionSummary {
  id: string
  name: string
  startedAt: string
  status: SessionStatus
  /** When the server received the last batch of the session. */
  lastEventAt: string
  /** When the server removes the session from memory; null while it is live. */
  expiresAt: string | null
  speakerCount: number
  segmentCount: number
}

export interface Speaker {
  id: string
  name: string
  /** Between speaker_joined and speaker_left. */
  present: boolean
}

export interface Segment {
  id: string
  speakerId: string
  speakerName: string
  start: string
  end: string
  text: string
  isFinal: boolean
}

export interface SessionDetail {
  session: SessionSummary
  speakers: Speaker[]
  segments: Segment[]
}

/** Change of one session, the result of applying a batch. */
export type SessionChange =
  | { type: 'session'; session: SessionSummary }
  | { type: 'speaker'; speaker: Speaker }
  | { type: 'segment'; segment: Segment }
  | { type: 'segment_removed'; id: string }

/** SSE `/api/sessions/:id/events`. `session_removed` is the last message: the stream ends. */
export type SessionStreamMessage =
  { type: 'snapshot'; detail: SessionDetail } | SessionChange | { type: 'session_removed' }

/** SSE `/api/sessions/events`. */
export type ListStreamMessage =
  | { type: 'snapshot'; sessions: SessionSummary[] }
  | { type: 'session'; session: SessionSummary }
  | { type: 'session_removed'; id: string }
