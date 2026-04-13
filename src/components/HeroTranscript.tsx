import { useState, useCallback } from 'react'
import { useStore, COLORS } from '../store/useStore'

export function HeroTranscript() {
  const transcript = useStore((s) => s.transcript)
  const setTranscript = useStore((s) => s.setTranscript)
  const mode = useStore((s) => s.mode)
  const playingIndex = useStore((s) => s.playingIndex)
  const samples = useStore((s) => s.samples)
  const isRecording = useStore((s) => s.isRecording)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  // Show different content based on state
  const displayText = isRecording
    ? transcript || 'Listening...'
    : transcript || 'AWAITING AUDIO'

  const words = displayText.trim().split(/\s+/).filter(Boolean)

  // Get color for the playing word
  const playingColor = playingIndex !== null && samples[playingIndex]
    ? COLORS[samples[playingIndex].id % COLORS.length]
    : null

  const startEditing = useCallback(() => {
    if (mode === 'edit' && transcript) {
      setEditValue(transcript)
      setIsEditing(true)
    }
  }, [mode, transcript])

  const saveEdit = useCallback(() => {
    setTranscript(editValue)
    setIsEditing(false)
  }, [editValue, setTranscript])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }, [saveEdit, cancelEdit])

  if (isEditing) {
    return (
      <div className="hero-transcript editing">
        <input
          type="text"
          className="transcript-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={saveEdit}
          autoFocus
          placeholder="Type syllables separated by spaces..."
        />
        <span className="edit-hint">Press Enter to save, Esc to cancel</span>
      </div>
    )
  }

  return (
    <div
      className={`hero-transcript ${mode === 'play' ? 'visible' : ''} ${isRecording ? 'recording' : ''} ${mode === 'edit' && transcript ? 'editable' : ''}`}
      onClick={startEditing}
      title={mode === 'edit' && transcript ? 'Click to edit transcript' : undefined}
    >
      {words.map((word, i) => {
        const isLit = mode === 'play' && playingIndex === i
        return (
          <span
            key={i}
            className={`syllable ${isLit ? 'lit' : ''}`}
            style={isLit && playingColor ? {
              color: playingColor,
              textShadow: `0 0 40px ${playingColor}, 0 0 80px ${playingColor}`,
            } : undefined}
          >
            {word}
          </span>
        )
      })}
      {mode === 'edit' && transcript && (
        <span className="edit-icon" title="Click to edit">&#9998;</span>
      )}
    </div>
  )
}
