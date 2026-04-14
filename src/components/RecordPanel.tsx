import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { useRecorder } from '../hooks/useRecorder'

export function RecordPanel() {
  const isRecording = useStore((s) => s.isRecording)
  const { startRecording, stopRecording, isMobile } = useRecorder()

  const handleClick = () => {
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
      >
        {isRecording ? 'STOP' : 'REC'}
      </button>
      <div className="mic-hint">
        {isMobile
          ? 'Tap REC to record'
          : 'Sing Do Re Mi Fa Sol La Si'}
      </div>
    </motion.div>
  )
}
