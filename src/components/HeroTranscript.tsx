import { useStore, COLORS } from '../store/useStore'

export function HeroTranscript() {
  const transcript = useStore((s) => s.transcript)
  const mode = useStore((s) => s.mode)
  const playingIndex = useStore((s) => s.playingIndex)
  const samples = useStore((s) => s.samples)
  const isRecording = useStore((s) => s.isRecording)

  // Show different content based on state
  const displayText = isRecording
    ? transcript || 'Listening...'
    : transcript || 'AWAITING AUDIO'

  const words = displayText.trim().split(/\s+/).filter(Boolean)

  // Get color for the playing word
  const playingColor = playingIndex !== null && samples[playingIndex]
    ? COLORS[samples[playingIndex].id % COLORS.length]
    : null

  return (
    <div className={`hero-transcript ${mode === 'play' ? 'visible' : ''} ${isRecording ? 'recording' : ''}`}>
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
