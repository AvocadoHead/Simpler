import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { useAudioEngine } from './useAudioEngine'
import type { Sample } from '../types'

const KEY_MAP: Record<string, number> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  '0': 9,
}

export function useKeyboard() {
  const mode = useStore((s) => s.mode)
  const samples = useStore((s) => s.samples)
  const setSelectedId = useStore((s) => s.setSelectedId)
  const setPlayingIndex = useStore((s) => s.setPlayingIndex)
  const { playSample, stopSample } = useAudioEngine()

  const pressedKeysRef = useRef<Set<string>>(new Set())
  const playingRef = useRef<Map<number, Sample>>(new Map())

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, [contenteditable="true"]')) return
    if (mode !== 'play') return
    if (e.repeat) return // Ignore key repeat

    const index = KEY_MAP[e.key]
    if (index === undefined) return

    const sample = samples[index]
    if (!sample) return

    if (pressedKeysRef.current.has(e.key)) return
    pressedKeysRef.current.add(e.key)

    setSelectedId(sample.id)
    setPlayingIndex(index)
    playSample(sample, () => {
      // Only clear if this sample is still the one playing
      if (playingRef.current.get(index) === sample) {
        setPlayingIndex(null)
      }
    })
    playingRef.current.set(index, sample)
  }, [mode, samples, setSelectedId, setPlayingIndex, playSample])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, [contenteditable="true"]')) return
    if (mode !== 'play') return

    const index = KEY_MAP[e.key]
    if (index === undefined) return

    pressedKeysRef.current.delete(e.key)

    const sample = playingRef.current.get(index)
    if (sample) {
      stopSample(sample.id, sample)
      playingRef.current.delete(index)
      setPlayingIndex(null)
    }
  }, [mode, stopSample, setPlayingIndex])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  return {
    pressedKeys: pressedKeysRef.current,
  }
}
