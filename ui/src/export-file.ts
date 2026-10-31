// Session export to a JSON file and back. The file is the UI's own format: the session
// as the page shows it (SessionDetail) plus a marker and the export time.
import type { Segment, SessionDetail, Speaker } from '@transcript-ui/shared'

const FORMAT = 'livekit-transcript-ui/session'
const VERSION = 1

export interface ExportFile extends SessionDetail {
  format: typeof FORMAT
  version: typeof VERSION
  exportedAt: string
}

export function downloadSession(detail: SessionDetail): void {
  const file: ExportFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    ...detail,
  }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName(detail)
  link.click()
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** `<room>_<YYYY-MM-DD_HH-mm>.json`, local time of the session start. */
function fileName({ session }: SessionDetail): string {
  const d = new Date(session.startedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
  const room = session.name.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'session'
  return `${room}_${stamp}.json`
}

/** Parses and checks an exported file; throws Error with a message for the user. */
export function parseExport(text: string): ExportFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Файл не JSON.')
  }
  if (!isObject(data) || data.format !== FORMAT) {
    throw new Error('Это не экспорт транскрипта.')
  }
  if (data.version !== VERSION) {
    throw new Error(`Версия файла ${String(data.version)} не поддерживается.`)
  }
  const { session, speakers, segments, exportedAt } = data
  const ok =
    isString(exportedAt) &&
    isObject(session) &&
    ['id', 'name', 'startedAt', 'status', 'lastEventAt'].every((k) => isString(session[k])) &&
    Array.isArray(speakers) &&
    speakers.every(isSpeaker) &&
    Array.isArray(segments) &&
    segments.every(isSegment)
  if (!ok) throw new Error('Файл повреждён: не хватает полей.')
  return data as unknown as ExportFile
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isString = (v: unknown): v is string => typeof v === 'string'

const isSpeaker = (v: unknown): v is Speaker =>
  isObject(v) && isString(v.id) && isString(v.name) && typeof v.present === 'boolean'

const isSegment = (v: unknown): v is Segment =>
  isObject(v) &&
  ['id', 'speakerId', 'speakerName', 'start', 'end', 'text'].every((k) => isString(v[k])) &&
  typeof v.isFinal === 'boolean'
