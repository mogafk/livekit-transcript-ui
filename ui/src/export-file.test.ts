import type { SessionDetail } from '@transcript-ui/shared'
import { describe, expect, it } from 'vitest'
import { parseExport } from './export-file'

const detail: SessionDetail = {
  session: {
    id: 's1',
    name: 'room',
    startedAt: '2026-10-31T12:00:00.000Z',
    status: 'ended',
    lastEventAt: '2026-10-31T12:30:00.000Z',
    speakerCount: 1,
    segmentCount: 1,
  },
  speakers: [{ id: 'alice', name: 'Alice', present: false }],
  segments: [
    {
      id: 'alice:1',
      speakerId: 'alice',
      speakerName: 'Alice',
      start: '2026-10-31T12:00:01.000Z',
      end: '2026-10-31T12:00:02.000Z',
      text: 'Hi',
      isFinal: true,
    },
  ],
}

const file = {
  format: 'livekit-transcript-ui/session',
  version: 1,
  exportedAt: '2026-10-31T13:00:00.000Z',
  ...detail,
}

describe('parseExport', () => {
  it('reads an exported file back', () => {
    expect(parseExport(JSON.stringify(file))).toEqual(file)
  })

  it('explains what is wrong with a bad file', () => {
    expect(() => parseExport('{oops')).toThrow('не JSON')
    expect(() => parseExport('{"a": 1}')).toThrow('не экспорт')
    expect(() => parseExport(JSON.stringify({ ...file, version: 2 }))).toThrow('Версия файла 2')
    const broken = { ...file, segments: [{ id: 'x' }] }
    expect(() => parseExport(JSON.stringify(broken))).toThrow('повреждён')
  })
})
