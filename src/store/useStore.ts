import { create } from 'zustand'
import type { Mode, Sample } from '../types'

interface State {
  mode: Mode
  samples: Sample[]
  selectedIds: number[]  // Multi-select support
  playingIndex: number | null  // Track which sample index is currently playing
  audioBuffer: AudioBuffer | null
  transcript: string
  isRecording: boolean

  setMode: (mode: Mode) => void
  setSamples: (samples: Sample[]) => void
  addSample: (sample: Sample) => void
  updateSample: (id: number, updates: Partial<Sample>) => void
  updateSelectedSamples: (updates: Partial<Sample>) => void  // Update all selected
  deleteSample: (id: number) => void
  setSelectedId: (id: number | null) => void  // Single select (clears others)
  toggleSelectedId: (id: number) => void  // Add/remove from selection
  selectAllSamples: () => void
  clearSelection: () => void
  setPlayingIndex: (index: number | null) => void
  setAudioBuffer: (buffer: AudioBuffer | null) => void
  setTranscript: (transcript: string) => void
  setIsRecording: (isRecording: boolean) => void
  swapSamples: (fromIndex: number, toIndex: number) => void
}

export const useStore = create<State>((set) => ({
  mode: 'record',
  samples: [],
  selectedIds: [],
  playingIndex: null,
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

  updateSelectedSamples: (updates) => set((state) => ({
    samples: state.samples.map((s) =>
      state.selectedIds.includes(s.id) ? { ...s, ...updates } : s
    ),
  })),

  deleteSample: (id) => set((state) => ({
    samples: state.samples.filter((s) => s.id !== id),
    selectedIds: state.selectedIds.filter((sid) => sid !== id),
  })),

  setSelectedId: (id) => set({ selectedIds: id !== null ? [id] : [] }),

  toggleSelectedId: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter((sid) => sid !== id)
      : [...state.selectedIds, id]
  })),

  selectAllSamples: () => set((state) => ({
    selectedIds: state.samples.map((s) => s.id)
  })),

  clearSelection: () => set({ selectedIds: [] }),

  setPlayingIndex: (index) => set({ playingIndex: index }),

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
