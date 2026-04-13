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

// Slide animations for mode transitions
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
}

const slideTransition = {
  x: { type: 'spring', stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
}

// Fade up animation for panels within a mode
const fadeUpVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const fadeTransition = {
  type: 'spring',
  stiffness: 400,
  damping: 35,
}

// Map modes to numeric values for direction calculation
const modeOrder = { record: 0, edit: 1, play: 2 }

function App() {
  const mode = useStore((s) => s.mode)
  const previousMode = useStore((s) => s.previousMode)
  const selectedIds = useStore((s) => s.selectedIds)
  const deleteSample = useStore((s) => s.deleteSample)
  const theme = useStore((s) => s.theme)

  // Initialize keyboard controls
  useKeyboard()

  const handleDelete = () => {
    // Delete all selected samples
    selectedIds.forEach((id) => deleteSample(id))
  }

  // Calculate slide direction based on mode change
  const direction = modeOrder[mode] - modeOrder[previousMode || 'record']

  return (
    <div className={`app mode-${mode}`} data-theme={theme}>
      <TopNav />
      <ModeTabs />
      <HeroTranscript />

      <div className="workspace">
        <AnimatePresence mode="wait" custom={direction}>
          {mode === 'record' && (
            <motion.div
              key="record"
              className="mode-container"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              <RecordPanel />
            </motion.div>
          )}

          {mode === 'edit' && (
            <motion.div
              key="edit"
              className="mode-container edit-container"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              <motion.div
                className="panel edit-wave-panel"
                variants={fadeUpVariants}
                initial="initial"
                animate="animate"
                transition={fadeTransition}
              >
                <WaveformEditor />
              </motion.div>

              <motion.div
                className="panel edit-tools-panel"
                variants={fadeUpVariants}
                initial="initial"
                animate="animate"
                transition={{ ...fadeTransition, delay: 0.08 }}
              >
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
              </motion.div>
            </motion.div>
          )}

          {mode === 'play' && (
            <motion.div
              key="play"
              className="mode-container"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              <motion.div
                className="panel play-panel"
                variants={fadeUpVariants}
                initial="initial"
                animate="animate"
                transition={fadeTransition}
              >
                <SampleGrid isEditMode={false} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default App
