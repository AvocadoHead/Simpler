import { useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { useAudioEngine } from './useAudioEngine'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

// Detect silence gaps in audio to find word boundaries
function detectSilenceGaps(
  buffer: AudioBuffer,
  options: {
    silenceThreshold?: number
    minSilenceDuration?: number
    minSegmentDuration?: number
  } = {}
): number[] {
  const {
    silenceThreshold = 0.02,
    minSilenceDuration = 0.08,  // 80ms minimum silence between words
    minSegmentDuration = 0.1,   // 100ms minimum segment length
  } = options

  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const minSilenceSamples = Math.floor(minSilenceDuration * sampleRate)

  // Find RMS energy in windows
  const windowSize = Math.floor(0.01 * sampleRate) // 10ms windows
  const energies: number[] = []

  for (let i = 0; i < data.length; i += windowSize) {
    let sum = 0
    const end = Math.min(i + windowSize, data.length)
    for (let j = i; j < end; j++) {
      sum += data[j] * data[j]
    }
    energies.push(Math.sqrt(sum / (end - i)))
  }

  // Find silence regions
  const silenceRegions: Array<{ start: number; end: number }> = []
  let silenceStart: number | null = null

  for (let i = 0; i < energies.length; i++) {
    const isSilent = energies[i] < silenceThreshold

    if (isSilent && silenceStart === null) {
      silenceStart = i * windowSize
    } else if (!isSilent && silenceStart !== null) {
      const silenceEnd = i * windowSize
      if (silenceEnd - silenceStart >= minSilenceSamples) {
        silenceRegions.push({ start: silenceStart, end: silenceEnd })
      }
      silenceStart = null
    }
  }

  // Convert silence regions to segment boundaries
  const boundaries: number[] = [0]

  for (const region of silenceRegions) {
    // Use the middle of the silence gap as the boundary
    const midpoint = (region.start + region.end) / 2 / sampleRate

    // Only add if it creates a segment longer than minimum
    const lastBoundary = boundaries[boundaries.length - 1]
    if (midpoint - lastBoundary >= minSegmentDuration) {
      boundaries.push(midpoint)
    }
  }

  // Add end boundary
  boundaries.push(buffer.duration)

  return boundaries
}

export function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const transcriptRef = useRef<string>('')

  const { resumeContext, getContext } = useAudioEngine()
  const setAudioBuffer = useStore((s) => s.setAudioBuffer)
  const setTranscript = useStore((s) => s.setTranscript)
  const setSamples = useStore((s) => s.setSamples)
  const setIsRecording = useStore((s) => s.setIsRecording)
  const setMode = useStore((s) => s.setMode)

  const smartAutoSlice = useCallback((buffer: AudioBuffer, transcript: string) => {
    const words = transcript.trim().split(/\s+/).filter(Boolean)
    const wordCount = words.length

    // Detect silence gaps in audio
    const boundaries = detectSilenceGaps(buffer, {
      silenceThreshold: 0.015,
      minSilenceDuration: 0.06,
      minSegmentDuration: 0.08,
    })

    // Create segments from boundaries
    const segments: Array<{ start: number; end: number }> = []
    for (let i = 0; i < boundaries.length - 1; i++) {
      segments.push({
        start: boundaries[i],
        end: boundaries[i + 1],
      })
    }

    // Limit to 10 samples max
    let finalSegments = segments

    if (segments.length > 10) {
      // Merge smallest adjacent segments until we have 10
      while (finalSegments.length > 10) {
        let minDuration = Infinity
        let minIndex = 0

        for (let i = 0; i < finalSegments.length - 1; i++) {
          const combined = finalSegments[i + 1].end - finalSegments[i].start
          if (combined < minDuration) {
            minDuration = combined
            minIndex = i
          }
        }

        // Merge segments at minIndex and minIndex + 1
        finalSegments = [
          ...finalSegments.slice(0, minIndex),
          { start: finalSegments[minIndex].start, end: finalSegments[minIndex + 1].end },
          ...finalSegments.slice(minIndex + 2),
        ]
      }
    } else if (segments.length < wordCount && wordCount <= 10) {
      // If we have fewer segments than words, try to match word count
      // by subdividing longer segments
      finalSegments = [...segments]

      while (finalSegments.length < Math.min(wordCount, 10)) {
        // Find longest segment
        let maxDuration = 0
        let maxIndex = 0

        for (let i = 0; i < finalSegments.length; i++) {
          const duration = finalSegments[i].end - finalSegments[i].start
          if (duration > maxDuration) {
            maxDuration = duration
            maxIndex = i
          }
        }

        // Split it in half
        const seg = finalSegments[maxIndex]
        const mid = (seg.start + seg.end) / 2

        finalSegments = [
          ...finalSegments.slice(0, maxIndex),
          { start: seg.start, end: mid },
          { start: mid, end: seg.end },
          ...finalSegments.slice(maxIndex + 1),
        ]
      }
    }

    // If no segments detected, fall back to word-based division
    if (finalSegments.length === 0 || (finalSegments.length === 1 && wordCount > 1)) {
      const duration = buffer.duration
      const count = Math.min(10, Math.max(1, wordCount || 3))
      const sliceLength = duration / count

      finalSegments = []
      for (let i = 0; i < count; i++) {
        finalSegments.push({
          start: i * sliceLength,
          end: (i + 1) * sliceLength,
        })
      }
    }

    // Create samples from segments
    const samples = finalSegments.map((seg, i) => ({
      id: i,
      start: seg.start,
      end: seg.end - 0.01, // Small gap for visual separation
      pitch: 0,
      speed: 1,
      vol: 80,
      phase: 0,
      sus: 0.3,
      rev: 0,
    }))

    setSamples(samples)
  }, [setSamples])

  const startRecording = useCallback(async () => {
    await resumeContext()

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      }
    })
    streamRef.current = stream

    // Use audio/webm for better quality and longer recordings
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    chunksRef.current = []
    transcriptRef.current = ''

    // Setup speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      // Use browser's default language for auto-detection
      recognition.lang = ''

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' '
          } else {
            interimTranscript += result[0].transcript
          }
        }

        transcriptRef.current = (finalTranscript + interimTranscript).trim()
        setTranscript(transcriptRef.current)
      }

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error)
        // Don't stop on 'no-speech' errors, just continue
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Recognition error, continuing without transcription')
        }
      }

      // Restart recognition if it ends prematurely
      recognition.onend = () => {
        if (recorderRef.current?.state === 'recording') {
          try {
            recognition.start()
          } catch {
            // Already started or can't restart
          }
        }
      }

      recognitionRef.current = recognition
      try {
        recognition.start()
      } catch (e) {
        console.warn('Could not start speech recognition:', e)
      }
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = async () => {
      // Stop recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Already stopped
        }
      }

      const blob = new Blob(chunksRef.current, { type: mimeType })
      const ctx = getContext()

      try {
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer)

        setAudioBuffer(buffer)
        smartAutoSlice(buffer, transcriptRef.current)
        setMode('edit')
      } catch (error) {
        console.error('Error decoding audio:', error)
        alert('Error processing audio. Please try recording again.')
      }

      // Cleanup stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }

    // Request data every 1 second for longer recordings
    recorder.start(1000)
    setIsRecording(true)
  }, [resumeContext, getContext, setAudioBuffer, setTranscript, setIsRecording, setMode, smartAutoSlice])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Already stopped
      }
    }
    setIsRecording(false)
  }, [setIsRecording])

  const isSupported = useCallback(() => {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }, [])

  return {
    startRecording,
    stopRecording,
    isTranscriptionSupported: isSupported,
  }
}
