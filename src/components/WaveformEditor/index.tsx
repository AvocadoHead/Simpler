import { useRef, useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { Waveform } from './Waveform'
import { SampleMarker } from './SampleMarker'

export function WaveformEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const audioBuffer = useStore((s) => s.audioBuffer)
  const samples = useStore((s) => s.samples)

  const duration = audioBuffer?.duration ?? 0

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = () => {
      setContainerWidth(container.offsetWidth)
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  if (!audioBuffer) {
    return (
      <div className="canvas-container" ref={containerRef}>
        <div className="no-audio-message">Record audio to see waveform</div>
      </div>
    )
  }

  return (
    <div className="canvas-container" ref={containerRef}>
      <Waveform />
      {samples.map((sample) => (
        <SampleMarker
          key={sample.id}
          sample={sample}
          duration={duration}
          containerWidth={containerWidth}
        />
      ))}
    </div>
  )
}
