import { describe, expect, it } from 'vitest'
import { detectDevice, getBestRecorderMimeType, getRecordingErrorMessage } from './recording'

describe('detectDevice', () => {
  it('detects modern iPadOS Safari as iOS mobile', () => {
    const result = detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 5)
    expect(result.isIOS).toBe(true)
    expect(result.isMobile).toBe(true)
  })

  it('detects Android as mobile but not iOS', () => {
    const result = detectDevice('Mozilla/5.0 (Linux; Android 14; Pixel)', 'Linux armv8l', 1)
    expect(result.isIOS).toBe(false)
    expect(result.isMobile).toBe(true)
  })
})

describe('getBestRecorderMimeType', () => {
  it('prefers opus webm, then mp4, then browser default', () => {
    expect(getBestRecorderMimeType((type) => type === 'audio/webm;codecs=opus')).toBe('audio/webm;codecs=opus')
    expect(getBestRecorderMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4')
    expect(getBestRecorderMimeType(() => false)).toBe('')
  })
})

describe('getRecordingErrorMessage', () => {
  it('returns clear permission copy for microphone permission failures', () => {
    expect(getRecordingErrorMessage(new DOMException('', 'NotAllowedError'))).toContain('Microphone permission')
  })
})
