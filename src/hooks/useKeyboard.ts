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
  const { playSample, stopSample } = useAudioEngine()

  const pressedKeysRef = useRef<Set<string>>(new Set())
  const playingRef = useRef<Map<number, Sample>>(new Map())

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (mode !== 'play') return
    if (e.repeat) return // Ignore key repeat

    const index = KEY_MAP[e.key]
    if (index === undefined) return

    const sample = samples[index]
    if (!sample) return

    if (pressedKeysRef.current.has(e.key)) return
    pressedKeysRef.current.add(e.key)

    setSelectedId(sample.id)
    playSample(sample)
    playingRef.current.set(index, sample)
  }, [mode, samples, setSelectedId, playSample])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (mode !== 'play') return

    const index = KEY_MAP[e.key]
    if (index === undefined) return

    pressedKeysRef.current.delete(e.key)

    const sample = playingRef.current.get(index)
    if (sample) {
      stopSample(sample.id, sample)
      playingRef.current.delete(index)
    }
  }, [mode, stopSample])

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
