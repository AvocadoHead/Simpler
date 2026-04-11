import { useStore } from '../store/useStore'

export function HeroTranscript() {
  const transcript = useStore((s) => s.transcript)
  const mode = useStore((s) => s.mode)
  const selectedId = useStore((s) => s.selectedId)
  const samples = useStore((s) => s.samples)

  const words = (transcript || 'AWAITING AUDIO').trim().split(/\s+/).filter(Boolean)
  const selectedIndex = samples.findIndex((s) => s.id === selectedId)

  return (
    <div className={`hero-transcript ${mode === 'play' ? 'visible' : ''}`}>
      {words.map((word, i) => (
        <span
          key={i}
          className={`syllable ${mode === 'play' && i === selectedIndex ? 'lit' : ''}`}
        >
          {word}
        </span>
      ))}
    </div>
  )
}
