import { useRef, useCallback, useEffect, useState } from 'react'
import { useStore, COLORS } from '../../store/useStore'
import type { Sample } from '../../types'

interface SampleMarkerProps {
  sample: Sample
  duration: number
  containerWidth: number
}

export function SampleMarker({ sample, duration, containerWidth }: SampleMarkerProps) {
  const selectedIds = useStore((s) => s.selectedIds)
  const setSelectedId = useStore((s) => s.setSelectedId)
  const toggleSelectedId = useStore((s) => s.toggleSelectedId)
  const updateSample = useStore((s) => s.updateSample)

  const [isDragging, setIsDragging] = useState(false)
  const dragStateRef = useRef<{
    type: 'move' | 'left' | 'right'
    startX: number
    initialStart: number
    initialEnd: number
  } | null>(null)

  const color = COLORS[sample.id % COLORS.length]
  const isSelected = selectedIds.includes(sample.id)

  const left = (sample.start / duration) * 100
  const width = ((sample.end - sample.start) / duration) * 100

  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'move' | 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      toggleSelectedId(sample.id)
    } else {
      setSelectedId(sample.id)
    }
    setIsDragging(true)

    dragStateRef.current = {
      type,
      startX: e.clientX,
      initialStart: sample.start,
      initialEnd: sample.end,
    }
  }, [sample.id, sample.start, sample.end, setSelectedId, toggleSelectedId])

  const handleTouchStart = useCallback((e: React.TouchEvent, type: 'move' | 'left' | 'right') => {
    e.stopPropagation()
    setSelectedId(sample.id)
    setIsDragging(true)

    const touch = e.touches[0]
    dragStateRef.current = {
      type,
      startX: touch.clientX,
      initialStart: sample.start,
      initialEnd: sample.end,
    }
  }, [sample.id, sample.start, sample.end, setSelectedId])

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (clientX: number) => {
      const state = dragStateRef.current
      if (!state) return

      const deltaPixels = clientX - state.startX
      const deltaDuration = (deltaPixels / containerWidth) * duration
      const minLength = 0.02

      if (state.type === 'move') {
        const length = state.initialEnd - state.initialStart
        let newStart = state.initialStart + deltaDuration
        newStart = Math.max(0, Math.min(duration - length, newStart))
        updateSample(sample.id, { start: newStart, end: newStart + length })
      } else if (state.type === 'left') {
        let newStart = state.initialStart + deltaDuration
        newStart = Math.max(0, Math.min(state.initialEnd - minLength, newStart))
        updateSample(sample.id, { start: newStart })
      } else if (state.type === 'right') {
        let newEnd = state.initialEnd + deltaDuration
        newEnd = Math.min(duration, Math.max(state.initialStart + minLength, newEnd))
        updateSample(sample.id, { end: newEnd })
      }
    }

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX)
    const handleTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX)

    const handleUp = () => {
      setIsDragging(false)
      dragStateRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchend', handleUp)
    }
  }, [isDragging, duration, containerWidth, sample.id, updateSample])

  return (
    <div
      className={`sample-marker ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        '--color': color,
        '--color-alpha': `${color}40`,
        '--color-alpha-strong': `${color}80`,
        left: `${left}%`,
        width: `${width}%`,
      } as React.CSSProperties}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
      onTouchStart={(e) => handleTouchStart(e, 'move')}
    >
      <div
        className="clip-handle left"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
        onTouchStart={(e) => handleTouchStart(e, 'left')}
      />
      <div
        className="clip-handle right"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
        onTouchStart={(e) => handleTouchStart(e, 'right')}
      />
    </div>
  )
}
