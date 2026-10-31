import type { SessionStatus } from '@transcript-ui/shared'

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour12: false })

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const statusLabel: Record<SessionStatus, string> = {
  live: 'идёт',
  idle: 'нет событий',
  ended: 'завершена',
}

/** Stable hue per speaker id; lightness comes from the theme (see --speaker-l). */
export function speakerHue(id: string): number {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(hash) % 360
}
