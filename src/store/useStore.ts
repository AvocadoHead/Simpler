import { create } from 'zustand'
import type { Mode, Sample } from '../types'

type Theme = 'dark' | 'light'

interface State {
  mode: Mode
  previousMode: Mode | null
  theme: Theme
  samples: Sample[]
  selectedIds: number[]  // Multi-select support
  playingIndex: number | null  // Track which sample index is currently playing
  audioBuffer: AudioBuffer | null
  transcript: string
  isRecording: boolean
  audioLevel: number  // Live audio input level (0-1)

  setMode: (mode: Mode) => void
  toggleTheme: () => void
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
  setAudioLevel: (level: number) => void
  swapSamples: (fromIndex: number, toIndex: number) => void
}

// Check for saved theme preference
const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('simpler-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
      return saved
    }
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light')
      return 'light'
    }
    document.documentElement.setAttribute('data-theme', 'dark')
  }
  return 'dark'
}

export const useStore = create<State>((set) => ({
  mode: 'record',
  previousMode: null,
  theme: getInitialTheme(),
  samples: [],
  selectedIds: [],
  playingIndex: null,
  audioBuffer: null,
  transcript: '',
  isRecording: false,
  audioLevel: 0,

  setMode: (mode) => set((state) => ({
    mode,
    previousMode: state.mode,
  })),

  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('simpler-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    return { theme: newTheme }
  }),

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

  setAudioLevel: (level) => set({ audioLevel: level }),

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
