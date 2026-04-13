import { useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { ActiveSource, Sample } from '../types'

// Granular synthesis for independent pitch/speed control
function createGranularPlayer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  startTime: number,
  duration: number,
  pitch: number,
  speed: number,
  outputNode: AudioNode
): { sources: AudioBufferSourceNode[]; stop: () => void } {
  const grainSize = 0.05 // 50ms grains
  const overlap = 0.5 // 50% overlap
  const hopSize = grainSize * (1 - overlap)

  // Pitch ratio (2^(semitones/12))
  const pitchRatio = Math.pow(2, pitch / 12)

  // Speed affects how fast we move through the source
  // Pitch affects the playback rate of each grain
  const sources: AudioBufferSourceNode[] = []
  let stopped = false

  // Calculate number of grains needed
  const outputDuration = duration / speed
  const numGrains = Math.ceil(outputDuration / hopSize) + 2

  for (let i = 0; i < numGrains && !stopped; i++) {
    const grainStartInOutput = i * hopSize
    const grainStartInSource = startTime + (grainStartInOutput * speed)

    // Don't create grain if it would start past the source
    if (grainStartInSource >= startTime + duration) break

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = pitchRatio

    // Create envelope for smooth grain transitions
    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, ctx.currentTime + grainStartInOutput)
    envelope.gain.linearRampToValueAtTime(1, ctx.currentTime + grainStartInOutput + grainSize * 0.1)
    envelope.gain.setValueAtTime(1, ctx.currentTime + grainStartInOutput + grainSize * 0.9)
    envelope.gain.linearRampToValueAtTime(0, ctx.currentTime + grainStartInOutput + grainSize)

    source.connect(envelope)
    envelope.connect(outputNode)

    // Calculate grain duration in source time
    const grainDurationInSource = Math.min(
      grainSize * pitchRatio,
      (startTime + duration) - grainStartInSource
    )

    if (grainDurationInSource > 0) {
      source.start(ctx.currentTime + grainStartInOutput, grainStartInSource, grainDurationInSource)
      sources.push(source)
    }
  }

  return {
    sources,
    stop: () => {
      stopped = true
      sources.forEach(s => {
        try { s.stop() } catch { /* already stopped */ }
      })
    }
  }
}

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
    ensureReverb()

    // Stop previous instance if playing
    const existing = activeSourcesRef.current.get(sample.id)
    if (existing) {
      existing.stopGrains?.()
      try {
        existing.source?.stop()
      } catch { /* already stopped */ }
      activeSourcesRef.current.delete(sample.id)
    }

    // Main gain envelope
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(sample.vol / 100, ctx.currentTime + 0.01)

    // Square wave LFO for chop effect
    let lfo: OscillatorNode | undefined
    let lfoGain: GainNode | undefined
    let chopGain: GainNode | undefined

    if (sample.chop > 0) {
      // LFO frequency: 1Hz to 20Hz based on chop value
      const lfoFreq = 1 + (sample.chop / 100) * 19

      lfo = ctx.createOscillator()
      lfo.type = 'square'
      lfo.frequency.value = lfoFreq

      // LFO gain controls modulation depth (0.5 = full on/off)
      lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.5

      // Chop gain node - LFO modulates this
      chopGain = ctx.createGain()
      chopGain.gain.value = 0.5 // Base value (LFO adds/subtracts 0.5)

      lfo.connect(lfoGain)
      lfoGain.connect(chopGain.gain)
      lfo.start()
    }

    // Delay setup
    let delayNode: DelayNode | undefined
    let feedbackGain: GainNode | undefined
    let delayWetGain: GainNode | undefined

    if (sample.delay > 0) {
      delayNode = ctx.createDelay(1.0)
      delayNode.delayTime.value = 0.15 + (sample.delay / 100) * 0.35 // 150ms to 500ms

      feedbackGain = ctx.createGain()
      feedbackGain.gain.value = 0.3 + (sample.delay / 100) * 0.4 // 30% to 70% feedback

      delayWetGain = ctx.createGain()
      delayWetGain.gain.value = sample.delay / 100 * 0.6 // Wet amount
    }

    // Reverb setup
    let convolver: ConvolverNode | undefined
    let reverbWetGain: GainNode | undefined
    const dryGain = ctx.createGain()

    const hasReverb = sample.rev > 0 && reverbBufferRef.current
    const hasDelay = sample.delay > 0

    if (hasReverb) {
      convolver = ctx.createConvolver()
      convolver.buffer = reverbBufferRef.current!
      reverbWetGain = ctx.createGain()
      reverbWetGain.gain.value = sample.rev / 100
      dryGain.gain.value = 1 - (sample.rev / 100) * 0.5
    } else {
      dryGain.gain.value = 1
    }

    // Build audio graph
    // Source -> gainNode -> [chopGain] -> [delay] -> dryGain -> destination
    //                                  -> [reverb] -> destination

    // Determine the node after gainNode (either chopGain or directly to effects)
    const connectFrom = chopGain ? chopGain : gainNode

    if (chopGain) {
      gainNode.connect(chopGain)
    }

    if (hasDelay && delayNode && feedbackGain && delayWetGain) {
      connectFrom.connect(delayNode)
      delayNode.connect(feedbackGain)
      feedbackGain.connect(delayNode) // Feedback loop
      delayNode.connect(delayWetGain)
      delayWetGain.connect(dryGain)
      connectFrom.connect(dryGain)
    } else {
      connectFrom.connect(dryGain)
    }

    if (hasReverb && convolver && reverbWetGain) {
      dryGain.connect(ctx.destination)
      dryGain.connect(convolver)
      convolver.connect(reverbWetGain)
      reverbWetGain.connect(ctx.destination)
    } else {
      dryGain.connect(ctx.destination)
    }

    // Sample timing
    const startOffset = sample.start
    const playDuration = sample.end - sample.start

    // Use granular synthesis for independent pitch/speed
    const needsGranular = sample.pitch !== 0 || sample.speed !== 1

    let source: AudioBufferSourceNode | null = null
    let grainSources: AudioBufferSourceNode[] = []
    let stopGrains: (() => void) | undefined

    if (needsGranular && (sample.pitch !== 0 || sample.speed !== 1)) {
      // Granular playback for independent pitch/speed
      const granular = createGranularPlayer(
        ctx,
        audioBuffer,
        startOffset,
        playDuration,
        sample.pitch,
        sample.speed,
        gainNode
      )
      grainSources = granular.sources
      stopGrains = granular.stop

      // Set up end callback
      const outputDuration = playDuration / sample.speed
      setTimeout(() => {
        if (activeSourcesRef.current.has(sample.id)) {
          activeSourcesRef.current.delete(sample.id)
          onEnd?.()
        }
      }, outputDuration * 1000 + 100)
    } else {
      // Simple playback when no pitch/speed change
      source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(gainNode)
      source.start(0, startOffset, playDuration)

      source.onended = () => {
        activeSourcesRef.current.delete(sample.id)
        onEnd?.()
      }
    }

    activeSourcesRef.current.set(sample.id, {
      source,
      gainNode,
      sampleId: sample.id,
      convolver,
      wetGain: reverbWetGain,
      dryGain,
      delayNode,
      feedbackGain,
      grainSources,
      stopGrains,
      lfo,
      lfoGain,
    })
  }, [audioBuffer, getContext, ensureReverb])

  const stopSample = useCallback((sampleId: number, sample: Sample, immediate = false) => {
    const ctx = getContext()
    const active = activeSourcesRef.current.get(sampleId)
    if (!active) return

    const releaseTime = immediate ? 0.01 : 0.15
    const timeConstant = releaseTime / 3

    // Fade out
    active.gainNode.gain.cancelScheduledValues(ctx.currentTime)
    active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, ctx.currentTime)
    active.gainNode.gain.setTargetAtTime(0, ctx.currentTime, timeConstant)

    if (active.wetGain) {
      active.wetGain.gain.cancelScheduledValues(ctx.currentTime)
      active.wetGain.gain.setValueAtTime(active.wetGain.gain.value, ctx.currentTime)
      active.wetGain.gain.setTargetAtTime(0, ctx.currentTime, timeConstant)
    }

    // Stop after fade + delay tail
    const stopDelay = releaseTime * 1000 + (sample.delay > 0 ? 600 : 0) + (sample.rev > 0 ? 400 : 0)
    setTimeout(() => {
      active.stopGrains?.()
      try {
        active.source?.stop()
      } catch { /* already stopped */ }
      try {
        active.lfo?.stop()
      } catch { /* already stopped */ }
      try {
        active.gainNode.disconnect()
        active.dryGain?.disconnect()
        active.wetGain?.disconnect()
        active.convolver?.disconnect()
        active.delayNode?.disconnect()
        active.feedbackGain?.disconnect()
        active.lfoGain?.disconnect()
      } catch { /* already disconnected */ }
    }, stopDelay)

    activeSourcesRef.current.delete(sampleId)
  }, [getContext])

  const isPlaying = useCallback((sampleId: number) => {
    return activeSourcesRef.current.has(sampleId)
  }, [])

  useEffect(() => {
    return () => {
      activeSourcesRef.current.forEach((active) => {
        active.stopGrains?.()
        try {
          active.source?.stop()
          active.lfo?.stop()
          active.gainNode.disconnect()
          active.dryGain?.disconnect()
          active.wetGain?.disconnect()
          active.convolver?.disconnect()
          active.delayNode?.disconnect()
          active.feedbackGain?.disconnect()
          active.lfoGain?.disconnect()
        } catch { /* already stopped/disconnected */ }
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
