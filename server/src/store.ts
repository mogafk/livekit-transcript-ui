// Sessions in memory only: they do not survive a restart, by design.
import type {
  ListStreamMessage,
  SessionDetail,
  SessionStreamMessage,
  SessionSummary,
} from '@transcript-ui/shared'
import { applyBatch, createSession, sortSegments, summarize, type SessionState } from './apply.ts'
import type { Batch } from './protocol.ts'

type Listener<T> = (message: T) => void

export class SessionStore {
  private readonly sessions = new Map<string, SessionState>()
  private readonly listListeners = new Set<Listener<ListStreamMessage>>()
  private readonly sessionListeners = new Map<string, Set<Listener<SessionStreamMessage>>>()
  private readonly idleTimeoutMs: number

  constructor(idleTimeoutMs: number) {
    this.idleTimeoutMs = idleTimeoutMs
  }

  ingest(batch: Batch, now = new Date()): void {
    const at = now.toISOString()
    let session = this.sessions.get(batch.session.id)
    if (!session) {
      session = createSession(batch.session, at)
      this.sessions.set(session.id, session)
    }
    // The whole batch is applied first, then subscribers get its changes.
    const changes = applyBatch(session, batch.events, at)
    for (const change of changes) this.emitSession(session.id, change)
    this.emitList({ type: 'session', session: summarize(session) })
  }

  /** Marks live sessions without events for idleTimeoutMs as idle. Called by a timer. */
  sweep(now = new Date()): void {
    for (const session of this.sessions.values()) {
      if (session.status !== 'live') continue
      if (now.getTime() - Date.parse(session.lastEventAt) < this.idleTimeoutMs) continue
      session.status = 'idle'
      const summary = summarize(session)
      this.emitSession(session.id, { type: 'session', session: summary })
      this.emitList({ type: 'session', session: summary })
    }
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()].map(summarize)
  }

  get(id: string): SessionDetail | undefined {
    const s = this.sessions.get(id)
    if (!s) return undefined
    return {
      session: summarize(s),
      speakers: [...s.speakers.values()],
      segments: sortSegments(s.segments.values()),
    }
  }

  /** The listener gets a snapshot right away, then changes. Returns unsubscribe. */
  subscribeList(listener: Listener<ListStreamMessage>): () => void {
    listener({ type: 'snapshot', sessions: this.list() })
    this.listListeners.add(listener)
    return () => this.listListeners.delete(listener)
  }

  /** Same as subscribeList; undefined if there is no such session. */
  subscribeSession(id: string, listener: Listener<SessionStreamMessage>): (() => void) | undefined {
    const detail = this.get(id)
    if (!detail) return undefined
    listener({ type: 'snapshot', detail })
    let listeners = this.sessionListeners.get(id)
    if (!listeners) {
      listeners = new Set()
      this.sessionListeners.set(id, listeners)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.sessionListeners.delete(id)
    }
  }

  private emitList(message: ListStreamMessage): void {
    for (const listener of this.listListeners) listener(message)
  }

  private emitSession(id: string, message: SessionStreamMessage): void {
    for (const listener of this.sessionListeners.get(id) ?? []) listener(message)
  }
}
