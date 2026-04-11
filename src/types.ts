export type Mode = 'record' | 'edit' | 'play'

export interface Sample {
  id: number
  start: number
  end: number
  pitch: number
  speed: number
  vol: number
  phase: number
  sus: number
  rev: number
}

export interface ActiveSource {
  source: AudioBufferSourceNode
  gainNode: GainNode
  sampleId: number
  convolver?: ConvolverNode
  wetGain?: GainNode
  dryGain?: GainNode
}
