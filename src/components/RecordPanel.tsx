import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { useRecorder } from '../hooks/useRecorder'

export function RecordPanel() {
  const isRecording = useStore((s) => s.isRecording)
  const recorderStatus = useStore((s) => s.recorderStatus)
  const recorderError = useStore((s) => s.recorderError)
  const { startRecording, stopRecording, isMobile } = useRecorder()
  const isBusy = recorderStatus === 'starting' || recorderStatus === 'processing'

  const handleClick = () => {
    if (isBusy) return

    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <motion.div
      className="panel record-panel"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <button
        className={`btn-record ${isRecording ? 'recording' : ''}`}
        onClick={handleClick}
        disabled={isBusy}
      >
        {recorderStatus === 'starting'
          ? 'WAIT'
          : recorderStatus === 'processing'
            ? 'SAVE'
            : isRecording ? 'STOP' : 'REC'}
      </button>
      <div className="mic-hint">
        {recorderStatus === 'processing'
          ? 'Processing audio...'
          : isMobile
            ? 'Record first, then dictate or type lyrics in Edit mode'
            : 'Sing Do Re Mi Fa Sol La Si'}
      </div>
      {recorderError && <div className="record-error">{recorderError}</div>}
    </motion.div>
  )
}
