import { useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { ActiveSource, Sample } from '../types'

export function useAudioEngine() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const reverbBufferRef = useRef<AudioBuffer | null>(null)
  const activeSourcesRef = useRef<Map<number, ActiveSource>>(new Map())
  const audioBuffer = useStore((s) => s.audioBuffer)

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  const generateReverb = useCallback(() => {
    const ctx = getContext()
    const length = ctx.sampleRate * 2.5
    const impulseResponse = ctx.createBuffer(2, length, ctx.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = impulseResponse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
      }
    }

    reverbBufferRef.current = impulseResponse
    return impulseResponse
  }, [getContext])

  const resumeContext = useCallback(async () => {
    const ctx = getContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    if (!reverbBufferRef.current) {
      generateReverb()
    }
    return ctx
  }, [getContext, generateReverb])

  const playSample = useCallback((sample: Sample, onEnd?: () => void) => {
    if (!audioBuffer) return

    const ctx = getContext()

    // Stop previous instance if playing
    const existing = activeSourcesRef.current.get(sample.id)
    if (existing) {
      try {
        existing.source.stop()
      } catch {
        // Already stopped
      }
      activeSourcesRef.current.delete(sample.id)
    }

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer

    // Pitch & Speed
    source.playbackRate.value = Math.max(0.1, Math.pow(2, sample.pitch / 12) * sample.speed)

    // Gain envelope
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(sample.vol / 100, ctx.currentTime + 0.01)

    // Reverb setup
    const dryGain = ctx.createGain()
    const wetGain = ctx.createGain()
    dryGain.gain.value = 1 - sample.rev / 100
    wetGain.gain.value = sample.rev / 100

    if (sample.rev > 0 && reverbBufferRef.current) {
      const convolver = ctx.createConvolver()
      convolver.buffer = reverbBufferRef.current
      gainNode.connect(convolver)
      convolver.connect(wetGain)
      wetGain.connect(ctx.destination)
    }

    gainNode.connect(dryGain)
    dryGain.connect(ctx.destination)
    source.connect(gainNode)

    // Phase calculation
    const clipLength = sample.end - sample.start
    const startOffset = sample.start + clipLength * (sample.phase / 100)

    source.start(0, startOffset, sample.end - startOffset)

    activeSourcesRef.current.set(sample.id, { source, gainNode, sampleId: sample.id })

    source.onended = () => {
      activeSourcesRef.current.delete(sample.id)
      onEnd?.()
    }
  }, [audioBuffer, getContext])

  const stopSample = useCallback((sampleId: number, sample: Sample, immediate = false) => {
    const ctx = getContext()
    const active = activeSourcesRef.current.get(sampleId)
    if (!active) return

    const releaseTime = immediate ? 0.01 : sample.sus
    active.gainNode.gain.cancelScheduledValues(ctx.currentTime)
    active.gainNode.gain.setTargetAtTime(0, ctx.currentTime, releaseTime / 3)

    setTimeout(() => {
      try {
        active.source.stop()
      } catch {
        // Already stopped
      }
    }, releaseTime * 1000)

    activeSourcesRef.current.delete(sampleId)
  }, [getContext])

  const isPlaying = useCallback((sampleId: number) => {
    return activeSourcesRef.current.has(sampleId)
  }, [])

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      activeSourcesRef.current.forEach((active) => {
        try {
          active.source.stop()
        } catch {
          // Already stopped
        }
      })
      activeSourcesRef.current.clear()
    }
  }, [])

  return {
    getContext,
    resumeContext,
    playSample,
    stopSample,
    isPlaying,
  }
}
