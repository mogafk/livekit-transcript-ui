// Sessions in memory only: they do not survive a restart, by design. A finished session
// is removed after retention — to keep it, the user downloads it as JSON from the UI.
import type {
  ListStreamMessage,
  SessionDetail,
  SessionStreamMessage,
  SessionSummary,
} from '@transcript-ui/shared'
import { applyBatch, createSession, sortSegments, summarize, type SessionState } from './apply.ts'
import type { Batch } from './protocol.ts'

type Listener<T> = (message: T) => void

export interface StoreOptions {
  /** A live session without batches for this long becomes idle. */
  idleTimeoutMs: number
  /** An ended or idle session is removed this long after its last batch. */
  retentionMs: number
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionState>()
  private readonly listListeners = new Set<Listener<ListStreamMessage>>()
  private readonly sessionListeners = new Map<string, Set<Listener<SessionStreamMessage>>>()
  private readonly options: StoreOptions

  constructor(options: StoreOptions) {
    this.options = options
  }

  ingest(batch: Batch, now = new Date()): void {
    const at = now.toISOString()
    let session = this.sessions.get(batch.session.id)
    if (!session) {
      session = createSession(batch.session, at)
      this.sessions.set(session.id, session)
    }
    // The whole batch is applied first, then subscribers get its changes.
    for (const change of applyBatch(session, batch.events, at)) {
      this.emitSession(session.id, change)
    }
    this.emitSummary(session)
  }

  /**
   * Called by a timer: live sessions without batches for idleTimeoutMs become idle,
   * finished ones past their expiresAt are removed.
   */
  sweep(now = new Date()): void {
    for (const session of this.sessions.values()) {
      const silentMs = now.getTime() - Date.parse(session.lastEventAt)
      if (session.status === 'live') {
        if (silentMs < this.options.idleTimeoutMs) continue
        session.status = 'idle'
        this.emitSummary(session)
      } else if (silentMs >= this.options.retentionMs) {
        this.remove(session.id)
      }
    }
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()].map((s) => this.summarize(s))
  }

  get(id: string): SessionDetail | undefined {
    const s = this.sessions.get(id)
    if (!s) return undefined
    return {
      session: this.summarize(s),
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

  private remove(id: string): void {
    this.sessions.delete(id)
    this.emitSession(id, { type: 'session_removed' })
    this.sessionListeners.delete(id)
    this.emitList({ type: 'session_removed', id })
  }

  private summarize(s: SessionState): SessionSummary {
    return summarize(s, this.options.retentionMs)
  }

  private emitSummary(s: SessionState): void {
    const summary = this.summarize(s)
    this.emitSession(s.id, { type: 'session', session: summary })
    this.emitList({ type: 'session', session: summary })
  }

  private emitList(message: ListStreamMessage): void {
    for (const listener of this.listListeners) listener(message)
  }

  private emitSession(id: string, message: SessionStreamMessage): void {
    for (const listener of this.sessionListeners.get(id) ?? []) listener(message)
  }
}
