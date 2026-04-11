import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import type { Mode } from '../types'

const tabs: { id: Mode; label: string }[] = [
  { id: 'record', label: 'Record' },
  { id: 'edit', label: 'Tweak' },
  { id: 'play', label: 'Play' },
]

export function ModeTabs() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)

  return (
    <div className="mode-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${mode === tab.id ? 'active' : ''}`}
          onClick={() => setMode(tab.id)}
        >
          {tab.label}
          {mode === tab.id && (
            <motion.div
              className="tab-indicator"
              layoutId="tab-indicator"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}
