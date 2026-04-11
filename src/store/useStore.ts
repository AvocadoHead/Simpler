import { create } from 'zustand'
import type { Mode, Sample } from '../types'

interface State {
  mode: Mode
  samples: Sample[]
  selectedId: number | null
  audioBuffer: AudioBuffer | null
  transcript: string
  isRecording: boolean

  setMode: (mode: Mode) => void
  setSamples: (samples: Sample[]) => void
  addSample: (sample: Sample) => void
  updateSample: (id: number, updates: Partial<Sample>) => void
  deleteSample: (id: number) => void
  setSelectedId: (id: number | null) => void
  setAudioBuffer: (buffer: AudioBuffer | null) => void
  setTranscript: (transcript: string) => void
  setIsRecording: (isRecording: boolean) => void
  swapSamples: (fromIndex: number, toIndex: number) => void
}

export const useStore = create<State>((set) => ({
  mode: 'record',
  samples: [],
  selectedId: null,
  audioBuffer: null,
  transcript: '',
  isRecording: false,

  setMode: (mode) => set({ mode }),

  setSamples: (samples) => set({ samples }),

  addSample: (sample) => set((state) => ({
    samples: [...state.samples, sample]
  })),

  updateSample: (id, updates) => set((state) => ({
    samples: state.samples.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    ),
  })),

  deleteSample: (id) => set((state) => ({
    samples: state.samples.filter((s) => s.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
  })),

  setSelectedId: (id) => set({ selectedId: id }),

  setAudioBuffer: (buffer) => set({ audioBuffer: buffer }),

  setTranscript: (transcript) => set({ transcript }),

  setIsRecording: (isRecording) => set({ isRecording }),

  swapSamples: (fromIndex, toIndex) => set((state) => {
    const newSamples = [...state.samples]
    const temp = newSamples[fromIndex]
    newSamples[fromIndex] = newSamples[toIndex]
    newSamples[toIndex] = temp
    return { samples: newSamples }
  }),
}))

export const COLORS = [
  '#ff4d4d', '#ffa64d', '#ffff4d', '#4dff4d', '#4dffff',
  '#4da6ff', '#a64dff', '#ff4da6', '#ffffff', '#8c8c8c'
]
