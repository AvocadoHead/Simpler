import { useStore } from '../store/useStore'

export function AddSampleButton() {
  const audioBuffer = useStore((s) => s.audioBuffer)
  const samples = useStore((s) => s.samples)
  const addSample = useStore((s) => s.addSample)

  const handleAdd = () => {
    if (!audioBuffer) return
    if (samples.length >= 10) {
      alert('Maximum 10 samples allowed')
      return
    }

    const duration = audioBuffer.duration

    // Find the highest existing ID
    const maxId = samples.reduce((max, s) => Math.max(max, s.id), -1)

    // Find a gap in the waveform or add at the end
    const lastEnd = samples.length > 0
      ? Math.max(...samples.map((s) => s.end))
      : 0

    const start = Math.min(lastEnd + 0.05, duration - 0.5)
    const end = Math.min(start + 0.5, duration)

    if (end - start < 0.1) {
      alert('Not enough space for a new sample')
      return
    }

    addSample({
      id: maxId + 1,
      start,
      end,
      pitch: 0,
      speed: 1,
      vol: 80,
      chop: 0,
      delay: 0,
      rev: 0,
    })
  }

  return (
    <button className="btn add-sample-btn" onClick={handleAdd} disabled={!audioBuffer}>
      + Add Sample
    </button>
  )
}
