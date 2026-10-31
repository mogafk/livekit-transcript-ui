export type ConnectionState = 'connecting' | 'open' | 'reconnecting'

const RETRY_MS = 3000

/**
 * SSE subscription. EventSource reconnects by itself after a network error, but gives up
 * on a non-200 answer (e.g. 404: the session is gone after a server restart) — then we
 * retry ourselves: the session appears again with the next batch of the transcriber.
 * Every (re)connect starts with a snapshot, so nothing has to be resynchronized.
 */
export function subscribe<T>(
  url: string,
  onMessage: (message: T) => void,
  onState: (state: ConnectionState) => void,
): () => void {
  let source: EventSource | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let closed = false

  const connect = () => {
    onState('connecting')
    source = new EventSource(url)
    source.onopen = () => onState('open')
    source.onmessage = (event) => onMessage(JSON.parse(event.data) as T)
    source.onerror = () => {
      onState('reconnecting')
      if (source?.readyState === EventSource.CLOSED && !closed) {
        retry = setTimeout(connect, RETRY_MS)
      }
    }
  }
  connect()

  return () => {
    closed = true
    clearTimeout(retry)
    source?.close()
  }
}
