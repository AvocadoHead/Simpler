import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { useRecorder } from '../hooks/useRecorder'

export function RecordPanel() {
  const isRecording = useStore((s) => s.isRecording)
  const { startRecording, stopRecording, isTranscriptionSupported } = useRecorder()

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
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <h3 className="input-level-label">Input Level</h3>
      <button
        className={`btn-record ${isRecording ? 'recording' : ''}`}
        onClick={handleClick}
      >
        {isRecording ? 'STOP' : 'REC'}
      </button>
      <div className="mic-hint">
        {isTranscriptionSupported()
          ? '(Requires Microphone Access)'
          : '(Speech recognition not supported in this browser)'}
      </div>
    </motion.div>
  )
}
