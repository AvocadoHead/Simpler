import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store/useStore'
import { useKeyboard } from './hooks/useKeyboard'
import { TopNav } from './components/TopNav'
import { ModeTabs } from './components/ModeTabs'
import { RecordPanel } from './components/RecordPanel'
import { WaveformEditor } from './components/WaveformEditor'
import { SampleGrid } from './components/SampleGrid'
import { ControlSliders } from './components/ControlSliders'
import { HeroTranscript } from './components/HeroTranscript'
import { AddSampleButton } from './components/AddSampleButton'

// Simple fade animation for all mode transitions
const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const fadeTransition = {
  duration: 0.15,
}

function App() {
  const mode = useStore((s) => s.mode)
  const selectedIds = useStore((s) => s.selectedIds)
  const deleteSample = useStore((s) => s.deleteSample)
  const theme = useStore((s) => s.theme)

  // Initialize keyboard controls
  useKeyboard()

  const handleDelete = () => {
    selectedIds.forEach((id) => deleteSample(id))
  }

  return (
    <div className={`app mode-${mode}`} data-theme={theme}>
      <TopNav />
      <ModeTabs />
      <HeroTranscript />

      <div className="workspace">
        <AnimatePresence mode="wait">
          {mode === 'record' && (
            <motion.div
              key="record"
              className="mode-container"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={fadeTransition}
            >
              <RecordPanel />
            </motion.div>
          )}

          {mode === 'edit' && (
            <motion.div
              key="edit"
              className="mode-container edit-container"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={fadeTransition}
            >
              <div className="panel edit-wave-panel">
                <WaveformEditor />
              </div>

              <div className="panel edit-tools-panel">
                <div className="tools-left">
                  <label className="sequencer-label">
                    Sequencer (Drag to Reorder)
                  </label>
                  <SampleGrid isEditMode={true} />
                  <AddSampleButton />
                  <button
                    className="btn btn-danger"
                    onClick={handleDelete}
                    disabled={selectedIds.length === 0}
                  >
                    Delete Selected{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}
                  </button>
                </div>

                <div className="tools-divider" />

                <ControlSliders />
              </div>
            </motion.div>
          )}

          {mode === 'play' && (
            <motion.div
              key="play"
              className="mode-container play-container"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={fadeTransition}
            >
              <SampleGrid isEditMode={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default App
