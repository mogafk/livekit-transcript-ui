import type { Segment, SessionStreamMessage, SessionSummary, Speaker } from '@transcript-ui/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { subscribe, type ConnectionState } from '../api/stream'

/** The session open in SessionView. */
export const useTranscriptStore = defineStore('transcript', () => {
  const session = ref<SessionSummary>()
  const speakers = ref(new Map<string, Speaker>())
  const segments = ref(new Map<string, Segment>())
  const connection = ref<ConnectionState>('connecting')
  let unsubscribe: (() => void) | undefined

  /** By start; ties — by id, as on the server. */
  const sortedSegments = computed(() =>
    [...segments.value.values()].sort(
      (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
    ),
  )

  const speakerList = computed(() => [...speakers.value.values()])

  function handle(message: SessionStreamMessage) {
    switch (message.type) {
      case 'snapshot':
        session.value = message.detail.session
        speakers.value = new Map(message.detail.speakers.map((s) => [s.id, s]))
        segments.value = new Map(message.detail.segments.map((s) => [s.id, s]))
        return
      case 'session':
        session.value = message.session
        return
      case 'speaker':
        speakers.value.set(message.speaker.id, message.speaker)
        return
      case 'segment':
        segments.value.set(message.segment.id, message.segment)
        return
      case 'segment_removed':
        segments.value.delete(message.id)
        return
    }
  }

  function open(id: string) {
    close()
    session.value = undefined
    speakers.value = new Map()
    segments.value = new Map()
    unsubscribe = subscribe(`/api/sessions/${encodeURIComponent(id)}/events`, handle, (s) => {
      connection.value = s
    })
  }

  function close() {
    unsubscribe?.()
    unsubscribe = undefined
  }

  return { session, speakerList, sortedSegments, connection, open, close }
})
