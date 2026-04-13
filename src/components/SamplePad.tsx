import { useState, useCallback, useRef, useEffect } from 'react'
import { useStore, COLORS } from '../store/useStore'
import { useAudioEngine } from '../hooks/useAudioEngine'
import type { Sample } from '../types'

interface SamplePadProps {
  sample: Sample
  index: number
  isEditMode: boolean
  onDragStart?: (e: React.DragEvent, index: number) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent, index: number) => void
}

export function SamplePad({
  sample,
  index,
  isEditMode,
  onDragStart,
  onDragOver,
  onDrop,
}: SamplePadProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const mode = useStore((s) => s.mode)
  const selectedIds = useStore((s) => s.selectedIds)
  const setSelectedId = useStore((s) => s.setSelectedId)
  const toggleSelectedId = useStore((s) => s.toggleSelectedId)
  const setPlayingIndex = useStore((s) => s.setPlayingIndex)
  const { playSample, stopSample } = useAudioEngine()
  const isHeldRef = useRef(false)

  const color = COLORS[sample.id % COLORS.length]
  const isSelected = selectedIds.includes(sample.id)

  const startPlay = useCallback((multiSelect = false) => {
    if (isHeldRef.current) return
    isHeldRef.current = true
    if (multiSelect) {
      toggleSelectedId(sample.id)
    } else {
      setSelectedId(sample.id)
    }
    setPlayingIndex(index)
    setIsPlaying(true)
    playSample(sample, () => {
      setIsPlaying(false)
      setPlayingIndex(null)
    })
  }, [sample, index, setSelectedId, toggleSelectedId, setPlayingIndex, playSample])

  const stopPlay = useCallback(() => {
    if (!isHeldRef.current) return
    isHeldRef.current = false
    stopSample(sample.id, sample)
    setIsPlaying(false)
    setPlayingIndex(null)
  }, [sample, stopSample, setPlayingIndex])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startPlay(e.shiftKey || e.metaKey || e.ctrlKey)
  }, [startPlay])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    startPlay(false) // No multi-select on touch, use Select All button
  }, [startPlay])

  // Global mouseup/touchend to catch release outside pad
  useEffect(() => {
    const handleGlobalUp = () => {
      if (isHeldRef.current) {
        stopPlay()
      }
    }

    window.addEventListener('mouseup', handleGlobalUp)
    window.addEventListener('touchend', handleGlobalUp)

    return () => {
      window.removeEventListener('mouseup', handleGlobalUp)
      window.removeEventListener('touchend', handleGlobalUp)
    }
  }, [stopPlay])

  return (
    <div
      className={`node active-pad ${isPlaying ? 'playing' : ''} ${isSelected ? 'selected' : ''}`}
      style={{ '--color': color } as React.CSSProperties}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      draggable={isEditMode}
      onDragStart={isEditMode ? (e) => onDragStart?.(e, index) : undefined}
      onDragOver={isEditMode ? onDragOver : undefined}
      onDrop={isEditMode ? (e) => onDrop?.(e, index) : undefined}
    >
      {mode !== 'play' && index + 1}
    </div>
  )
}
