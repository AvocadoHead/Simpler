export type Mode = 'record' | 'edit' | 'play'

export interface Sample {
  id: number
  start: number
  end: number
  pitch: number   // Semitones (-12 to +12) - independent of speed
  speed: number   // Playback speed (0.5x to 2x) - independent of pitch
  vol: number     // Volume (0-100)
  phase: number   // Start offset within sample (0-100%)
  delay: number   // Delay/echo amount (0-100)
  rev: number     // Reverb amount (0-100)
}

export interface ActiveSource {
  source: AudioBufferSourceNode | null
  gainNode: GainNode
  sampleId: number
  convolver?: ConvolverNode
  wetGain?: GainNode
  dryGain?: GainNode
  delayNode?: DelayNode
  feedbackGain?: GainNode
  grainSources?: AudioBufferSourceNode[]
  stopGrains?: () => void
}
