import type { ListStreamMessage, SessionSummary } from '@transcript-ui/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { subscribe, type ConnectionState } from '../api/stream'

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref(new Map<string, SessionSummary>())
  const connection = ref<ConnectionState>('connecting')
  const loaded = ref(false)
  let unsubscribe: (() => void) | undefined

  /** Ongoing first, then newest first. */
  const sorted = computed(() =>
    [...sessions.value.values()].sort(
      (a, b) =>
        Number(a.status === 'ended') - Number(b.status === 'ended') ||
        b.startedAt.localeCompare(a.startedAt),
    ),
  )

  function handle(message: ListStreamMessage) {
    if (message.type === 'snapshot') {
      sessions.value = new Map(message.sessions.map((s) => [s.id, s]))
      loaded.value = true
    } else {
      sessions.value.set(message.session.id, message.session)
    }
  }

  function open() {
    unsubscribe?.()
    unsubscribe = subscribe('/api/sessions/events', handle, (s) => (connection.value = s))
  }

  function close() {
    unsubscribe?.()
    unsubscribe = undefined
  }

  return { sorted, connection, loaded, open, close }
})
