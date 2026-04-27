import { useState, useCallback } from 'react'
import { useStore, COLORS } from '../store/useStore'
import { useSpeechDictation } from '../hooks/useSpeechDictation'
import { wordsFromTranscript } from '../utils/solfege'

export function HeroTranscript() {
  const transcript = useStore((s) => s.transcript)
  const setTranscript = useStore((s) => s.setTranscript)
  const mode = useStore((s) => s.mode)
  const playingIndex = useStore((s) => s.playingIndex)
  const samples = useStore((s) => s.samples)
  const isRecording = useStore((s) => s.isRecording)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const {
    isDictating,
    dictationError,
    isSupported: isDictationSupported,
    startDictation,
    stopDictation,
  } = useSpeechDictation((text) => setEditValue(text))

  // Show transcript, but hide "Listening..." placeholder when not recording
  const isPlaceholder = transcript === 'Listening...'
  const displayText = isRecording
    ? transcript || 'Listening...'
    : isPlaceholder ? '' : transcript

  const words = wordsFromTranscript(displayText)

  // Get color for the playing word
  const playingColor = playingIndex !== null && samples[playingIndex]
    ? COLORS[samples[playingIndex].id % COLORS.length]
    : null

  // Allow editing in edit mode (with or without existing transcript)
  const canEdit = mode === 'edit'

  const startEditing = useCallback(() => {
    if (canEdit) {
      setEditValue(transcript || '')
      setIsEditing(true)
    }
  }, [canEdit, transcript])

  const saveEdit = useCallback(() => {
    setTranscript(editValue)
    setIsEditing(false)
  }, [editValue, setTranscript])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleDictationClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isDictating) {
      stopDictation()
    } else {
      startDictation()
    }
  }, [isDictating, startDictation, stopDictation])

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
          placeholder="Type lyrics (e.g. Do Re Mi Fa Sol La Si)"
        />
        {isDictationSupported && (
          <button
            type="button"
            className={`dictation-btn ${isDictating ? 'active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDictationClick}
          >
            {isDictating ? 'Stop dictation' : 'Dictate lyrics'}
          </button>
        )}
        {dictationError && <span className="dictation-error">{dictationError}</span>}
        <span className="edit-hint">Enter to save · Esc to cancel</span>
      </div>
    )
  }

  // In edit mode with no transcript, show tap hint
  if (mode === 'edit' && words.length === 0) {
    return (
      <div
        className="hero-transcript editable empty"
        onClick={startEditing}
      >
        <span className="tap-hint">Tap to add lyrics</span>
        {isDictationSupported && (
          <button
            type="button"
            className={`dictation-btn ${isDictating ? 'active' : ''}`}
            onClick={handleDictationClick}
          >
            {isDictating ? 'Stop dictation' : 'Dictate lyrics'}
          </button>
        )}
        {dictationError && <span className="dictation-error">{dictationError}</span>}
      </div>
    )
  }

  return (
    <div
      className={`hero-transcript ${mode === 'play' ? 'visible' : ''} ${isRecording ? 'recording' : ''} ${canEdit && transcript ? 'editable' : ''}`}
      onClick={startEditing}
    >
      {mode === 'edit' && isDictationSupported && (
        <button
          type="button"
          className={`dictation-btn ${isDictating ? 'active' : ''}`}
          onClick={handleDictationClick}
        >
          {isDictating ? 'Stop dictation' : 'Dictate lyrics'}
        </button>
      )}
      {dictationError && mode === 'edit' && <span className="dictation-error">{dictationError}</span>}
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
    </div>
  )
}
