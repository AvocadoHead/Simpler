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
    // Create a longer, richer reverb impulse response
    const length = ctx.sampleRate * 3 // 3 second tail
    const impulseResponse = ctx.createBuffer(2, length, ctx.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = impulseResponse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        // Exponential decay with some randomness for natural sound
        const decay = Math.pow(1 - i / length, 2.5)
        data[i] = (Math.random() * 2 - 1) * decay
      }
    }

    reverbBufferRef.current = impulseResponse
    return impulseResponse
  }, [getContext])

  const ensureReverb = useCallback(() => {
    if (!reverbBufferRef.current) {
      generateReverb()
    }
    return reverbBufferRef.current!
  }, [generateReverb])

  const resumeContext = useCallback(async () => {
    const ctx = getContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    ensureReverb()
    return ctx
  }, [getContext, ensureReverb])

  const playSample = useCallback((sample: Sample, onEnd?: () => void) => {
    if (!audioBuffer) return

    const ctx = getContext()

    // Ensure reverb is ready
    ensureReverb()

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

    // Main gain envelope (for attack/release)
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(sample.vol / 100, ctx.currentTime + 0.01)

    // Create dry/wet mix for reverb
    const dryGain = ctx.createGain()
    const wetGain = ctx.createGain()

    // Calculate wet/dry mix based on reverb amount
    const wetAmount = sample.rev / 100
    dryGain.gain.setValueAtTime(1 - wetAmount * 0.5, ctx.currentTime) // Keep some dry signal
    wetGain.gain.setValueAtTime(wetAmount, ctx.currentTime)

    let convolver: ConvolverNode | undefined

    // Connect source -> gainNode
    source.connect(gainNode)

    if (sample.rev > 0 && reverbBufferRef.current) {
      // Create convolver for reverb
      convolver = ctx.createConvolver()
      convolver.buffer = reverbBufferRef.current

      // Dry path: gainNode -> dryGain -> destination
      gainNode.connect(dryGain)
      dryGain.connect(ctx.destination)

      // Wet path: gainNode -> convolver -> wetGain -> destination
      gainNode.connect(convolver)
      convolver.connect(wetGain)
      wetGain.connect(ctx.destination)
    } else {
      // No reverb: gainNode -> destination
      gainNode.connect(ctx.destination)
    }

    // Phase calculation
    const clipLength = sample.end - sample.start
    const startOffset = sample.start + clipLength * (sample.phase / 100)

    source.start(0, startOffset, sample.end - startOffset)

    activeSourcesRef.current.set(sample.id, {
      source,
      gainNode,
      sampleId: sample.id,
      convolver,
      wetGain,
      dryGain,
    })

    source.onended = () => {
      activeSourcesRef.current.delete(sample.id)
      onEnd?.()
    }
  }, [audioBuffer, getContext, ensureReverb])

  const stopSample = useCallback((sampleId: number, sample: Sample, immediate = false) => {
    const ctx = getContext()
    const active = activeSourcesRef.current.get(sampleId)
    if (!active) return

    // Sustain controls the release time (how long the sound fades out)
    const releaseTime = immediate ? 0.01 : Math.max(0.01, sample.sus)
    const timeConstant = releaseTime / 3 // Time constant for exponential decay

    // Apply release envelope to main gain
    active.gainNode.gain.cancelScheduledValues(ctx.currentTime)
    active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, ctx.currentTime)
    active.gainNode.gain.setTargetAtTime(0, ctx.currentTime, timeConstant)

    // Also fade out the wet signal if reverb is active
    if (active.wetGain) {
      active.wetGain.gain.cancelScheduledValues(ctx.currentTime)
      active.wetGain.gain.setValueAtTime(active.wetGain.gain.value, ctx.currentTime)
      active.wetGain.gain.setTargetAtTime(0, ctx.currentTime, timeConstant)
    }

    // Stop the source after release completes (plus a little extra for reverb tail)
    const stopDelay = releaseTime * 1000 + (sample.rev > 0 ? 500 : 0)
    setTimeout(() => {
      try {
        active.source.stop()
      } catch {
        // Already stopped
      }
      // Disconnect nodes to free resources
      try {
        active.gainNode.disconnect()
        active.dryGain?.disconnect()
        active.wetGain?.disconnect()
        active.convolver?.disconnect()
      } catch {
        // Already disconnected
      }
    }, stopDelay)

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
          active.gainNode.disconnect()
          active.dryGain?.disconnect()
          active.wetGain?.disconnect()
          active.convolver?.disconnect()
        } catch {
          // Already stopped/disconnected
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
