import type {
  Segment,
  SessionDetail,
  SessionStreamMessage,
  SessionSummary,
  Speaker,
} from '@transcript-ui/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { subscribe, type ConnectionState } from '../api/stream'
import type { ExportFile } from '../export-file'

/** A session opened from an exported file instead of the server. */
export interface FileSource {
  fileName: string
  exportedAt: string
}

/** The session open in SessionView: live from the server or from a file. */
export const useTranscriptStore = defineStore('transcript', () => {
  const session = ref<SessionSummary>()
  const speakers = ref(new Map<string, Speaker>())
  const segments = ref(new Map<string, Segment>())
  const connection = ref<ConnectionState>('connecting')
  const file = ref<FileSource>()
  let unsubscribe: (() => void) | undefined

  /** By start; ties — by id, as on the server. */
  const sortedSegments = computed(() =>
    [...segments.value.values()].sort(
      (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
    ),
  )

  const speakerList = computed(() => [...speakers.value.values()])

  /** What the page shows now — for export. */
  const detail = computed<SessionDetail | undefined>(() =>
    session.value
      ? { session: session.value, speakers: speakerList.value, segments: sortedSegments.value }
      : undefined,
  )

  function setDetail(d: SessionDetail) {
    session.value = d.session
    speakers.value = new Map(d.speakers.map((s) => [s.id, s]))
    segments.value = new Map(d.segments.map((s) => [s.id, s]))
  }

  function handle(message: SessionStreamMessage) {
    switch (message.type) {
      case 'snapshot':
        setDetail(message.detail)
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
    file.value = undefined
    session.value = undefined
    speakers.value = new Map()
    segments.value = new Map()
    unsubscribe = subscribe(`/api/sessions/${encodeURIComponent(id)}/events`, handle, (s) => {
      connection.value = s
    })
  }

  /** Shows an exported file. Kept only in memory: gone after a page reload. */
  function openFile(data: ExportFile, fileName: string) {
    close()
    setDetail(data)
    file.value = { fileName, exportedAt: data.exportedAt }
    connection.value = 'open'
  }

  function close() {
    unsubscribe?.()
    unsubscribe = undefined
  }

  return {
    session,
    speakerList,
    sortedSegments,
    detail,
    connection,
    file,
    open,
    openFile,
    close,
  }
})
