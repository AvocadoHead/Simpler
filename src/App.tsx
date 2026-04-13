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

const panelVariants = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
}

const panelTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

function App() {
  const mode = useStore((s) => s.mode)
  const selectedIds = useStore((s) => s.selectedIds)
  const deleteSample = useStore((s) => s.deleteSample)

  // Initialize keyboard controls
  useKeyboard()

  const handleDelete = () => {
    // Delete all selected samples
    selectedIds.forEach((id) => deleteSample(id))
  }

  return (
    <div className={`app mode-${mode}`}>
      <TopNav />
      <ModeTabs />
      <HeroTranscript />

      <div className="workspace">
        <AnimatePresence mode="wait">
          {mode === 'record' && (
            <RecordPanel key="record" />
          )}

          {mode === 'edit' && (
            <>
              <motion.div
                key="edit-wave"
                className="panel edit-wave-panel"
                variants={panelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelTransition}
              >
                <WaveformEditor />
              </motion.div>

              <motion.div
                key="edit-tools"
                className="panel edit-tools-panel"
                variants={panelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ ...panelTransition, delay: 0.1 }}
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
            </>
          )}

          {mode === 'play' && (
            <motion.div
              key="play"
              className="panel play-panel"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={panelTransition}
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
