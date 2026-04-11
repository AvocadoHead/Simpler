import { useCallback } from 'react'
import { useStore } from '../store/useStore'
import { SamplePad } from './SamplePad'

interface SampleGridProps {
  isEditMode: boolean
}

export function SampleGrid({ isEditMode }: SampleGridProps) {
  const samples = useStore((s) => s.samples)
  const swapSamples = useStore((s) => s.swapSamples)
  const mode = useStore((s) => s.mode)

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString())
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (fromIndex !== toIndex) {
      swapSamples(fromIndex, toIndex)
    }
  }, [swapSamples])

  return (
    <div className={`sequencer-grid ${mode === 'play' ? 'play-mode' : ''}`}>
      {samples.map((sample, index) => (
        <SamplePad
          key={sample.id}
          sample={sample}
          index={index}
          isEditMode={isEditMode}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
    </div>
  )
}
