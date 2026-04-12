import { useStore } from '../store/useStore'
import type { Sample } from '../types'

type ParamKey = 'pitch' | 'speed' | 'phase' | 'vol' | 'delay' | 'rev'

interface SliderConfig {
  key: ParamKey
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
}

const sliders: SliderConfig[] = [
  { key: 'pitch', label: 'Pitch (semitones)', min: -12, max: 12, step: 1, defaultValue: 0 },
  { key: 'speed', label: 'Speed', min: 0.5, max: 2, step: 0.1, defaultValue: 1 },
  { key: 'vol', label: 'Volume', min: 0, max: 100, step: 1, defaultValue: 80 },
  { key: 'phase', label: 'Start Offset', min: 0, max: 100, step: 1, defaultValue: 0 },
  { key: 'delay', label: 'Delay/Echo', min: 0, max: 100, step: 1, defaultValue: 0 },
  { key: 'rev', label: 'Reverb', min: 0, max: 100, step: 1, defaultValue: 0 },
]

const defaultValues: Record<ParamKey, number> = {
  pitch: 0,
  speed: 1,
  phase: 0,
  vol: 80,
  delay: 0,
  rev: 0,
}

export function ControlSliders() {
  const selectedId = useStore((s) => s.selectedId)
  const samples = useStore((s) => s.samples)
  const updateSample = useStore((s) => s.updateSample)

  const selectedSample = samples.find((s) => s.id === selectedId)
  const isActive = selectedSample !== undefined

  const handleChange = (key: ParamKey, value: number) => {
    if (selectedId !== null) {
      updateSample(selectedId, { [key]: value })
    }
  }

  const handleReset = () => {
    if (selectedId !== null) {
      updateSample(selectedId, { ...defaultValues })
    }
  }

  return (
    <div className={`controls-grid ${isActive ? 'active' : ''}`}>
      {sliders.map((slider) => (
        <div key={slider.key} className="param-row">
          <label>{slider.label}</label>
          <input
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={selectedSample?.[slider.key as keyof Sample] ?? slider.defaultValue}
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
          Reset
        </button>
      </div>
    </div>
  )
}
