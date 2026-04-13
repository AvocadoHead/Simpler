import { useStore } from '../store/useStore'
import type { Sample } from '../types'

type ParamKey = 'pitch' | 'speed' | 'chop' | 'vol' | 'delay' | 'rev'

interface SliderConfig {
  key: ParamKey
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
}

const sliders: SliderConfig[] = [
  { key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 1, defaultValue: 0 },
  { key: 'speed', label: 'Speed', min: 0.5, max: 2, step: 0.1, defaultValue: 1 },
  { key: 'vol', label: 'Volume', min: 0, max: 100, step: 1, defaultValue: 80 },
  { key: 'chop', label: 'Chop', min: 0, max: 100, step: 1, defaultValue: 0 },
  { key: 'delay', label: 'Delay', min: 0, max: 100, step: 1, defaultValue: 0 },
  { key: 'rev', label: 'Reverb', min: 0, max: 100, step: 1, defaultValue: 0 },
]

const defaultValues: Record<ParamKey, number> = {
  pitch: 0,
  speed: 1,
  chop: 0,
  vol: 80,
  delay: 0,
  rev: 0,
}

export function ControlSliders() {
  const selectedIds = useStore((s) => s.selectedIds)
  const samples = useStore((s) => s.samples)
  const updateSelectedSamples = useStore((s) => s.updateSelectedSamples)
  const selectAllSamples = useStore((s) => s.selectAllSamples)
  const clearSelection = useStore((s) => s.clearSelection)

  const selectedSamples = samples.filter((s) => selectedIds.includes(s.id))
  const isActive = selectedSamples.length > 0
  const isMultiple = selectedSamples.length > 1
  const allSelected = samples.length > 0 && selectedIds.length === samples.length

  // Get value for display - use first selected, or show default
  const getDisplayValue = (key: ParamKey): number => {
    if (selectedSamples.length === 0) return sliders.find(s => s.key === key)?.defaultValue ?? 0
    return selectedSamples[0][key as keyof Sample] as number
  }

  const handleChange = (key: ParamKey, value: number) => {
    if (selectedIds.length > 0) {
      updateSelectedSamples({ [key]: value })
    }
  }

  const handleReset = () => {
    if (selectedIds.length > 0) {
      updateSelectedSamples({ ...defaultValues })
    }
  }

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection()
    } else {
      selectAllSamples()
    }
  }

  return (
    <div className={`controls-grid ${isActive ? 'active' : ''}`}>
      <div className="param-row select-all-row">
        <button
          className={`btn btn-select-all ${allSelected ? 'selected' : ''}`}
          onClick={handleSelectAll}
          disabled={samples.length === 0}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
        {isMultiple && (
          <span className="multi-indicator">{selectedSamples.length} selected</span>
        )}
      </div>
      {sliders.map((slider) => (
        <div key={slider.key} className="param-row">
          <label>{slider.label}</label>
          <input
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={getDisplayValue(slider.key)}
            onChange={(e) => handleChange(slider.key, parseFloat(e.target.value))}
            disabled={!isActive}
          />
        </div>
      ))}
      <div className="param-row reset-row">
        <button
          className="btn btn-reset"
          onClick={handleReset}
          disabled={!isActive}
        >
          Reset{isMultiple ? ' All' : ''}
        </button>
      </div>
    </div>
  )
}
