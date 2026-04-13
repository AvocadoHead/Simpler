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

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// Detect mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// Find sound regions (non-silent parts) in audio
function findSoundRegions(
  buffer: AudioBuffer,
  options: {
    silenceThreshold?: number
    minSoundDuration?: number
    paddingMs?: number
  } = {}
): Array<{ start: number; end: number }> {
  const {
    silenceThreshold = 0.015,
    minSoundDuration = 0.05,  // 50ms minimum sound length
    paddingMs = 10,           // 10ms padding around sounds
  } = options

  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const padding = paddingMs / 1000

  // Find RMS energy in windows
  const windowSize = Math.floor(0.005 * sampleRate) // 5ms windows for precision
  const energies: number[] = []

  for (let i = 0; i < data.length; i += windowSize) {
    let sum = 0
    const end = Math.min(i + windowSize, data.length)
    for (let j = i; j < end; j++) {
      sum += data[j] * data[j]
    }
    energies.push(Math.sqrt(sum / (end - i)))
  }

  // Find sound regions (non-silent)
  const soundRegions: Array<{ start: number; end: number }> = []
  let soundStart: number | null = null

  for (let i = 0; i < energies.length; i++) {
    const hasSound = energies[i] >= silenceThreshold

    if (hasSound && soundStart === null) {
      soundStart = i * windowSize / sampleRate
    } else if (!hasSound && soundStart !== null) {
      const soundEnd = i * windowSize / sampleRate
      if (soundEnd - soundStart >= minSoundDuration) {
        soundRegions.push({
          start: Math.max(0, soundStart - padding),
          end: Math.min(buffer.duration, soundEnd + padding),
        })
      }
      soundStart = null
    }
  }

  // Handle sound at the end
  if (soundStart !== null) {
    const soundEnd = buffer.duration
    if (soundEnd - soundStart >= minSoundDuration) {
      soundRegions.push({
        start: Math.max(0, soundStart - padding),
        end: soundEnd,
      })
    }
  }

  // Merge overlapping or very close regions
  const mergedRegions: Array<{ start: number; end: number }> = []
  const mergeGap = 0.08 // Merge if gap < 80ms

  for (const region of soundRegions) {
    if (mergedRegions.length === 0) {
      mergedRegions.push(region)
    } else {
      const last = mergedRegions[mergedRegions.length - 1]
      if (region.start - last.end < mergeGap) {
        // Merge with previous
        last.end = region.end
      } else {
        mergedRegions.push(region)
      }
    }
  }

  return mergedRegions
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

    // Find actual sound regions (no silence included)
    let regions = findSoundRegions(buffer, {
      silenceThreshold: 0.012,
      minSoundDuration: 0.04,
      paddingMs: 8,
    })

    // If no regions found, use the whole buffer
    if (regions.length === 0) {
      regions = [{ start: 0, end: buffer.duration }]
    }

    // Limit to 10 samples max
    let finalRegions = regions

    if (regions.length > 10) {
      // Merge smallest adjacent regions until we have 10
      while (finalRegions.length > 10) {
        let minGap = Infinity
        let minIndex = 0

        for (let i = 0; i < finalRegions.length - 1; i++) {
          const gap = finalRegions[i + 1].start - finalRegions[i].end
          if (gap < minGap) {
            minGap = gap
            minIndex = i
          }
        }

        // Merge regions at minIndex and minIndex + 1
        finalRegions = [
          ...finalRegions.slice(0, minIndex),
          { start: finalRegions[minIndex].start, end: finalRegions[minIndex + 1].end },
          ...finalRegions.slice(minIndex + 2),
        ]
      }
    } else if (regions.length < wordCount && wordCount <= 10 && regions.length > 0) {
      // If we have fewer regions than words, try to split longer ones
      finalRegions = [...regions]

      while (finalRegions.length < Math.min(wordCount, 10)) {
        // Find longest region
        let maxDuration = 0
        let maxIndex = 0

        for (let i = 0; i < finalRegions.length; i++) {
          const duration = finalRegions[i].end - finalRegions[i].start
          if (duration > maxDuration) {
            maxDuration = duration
            maxIndex = i
          }
        }

        // Only split if longer than 200ms
        if (maxDuration < 0.2) break

        // Split it in half
        const region = finalRegions[maxIndex]
        const mid = (region.start + region.end) / 2

        finalRegions = [
          ...finalRegions.slice(0, maxIndex),
          { start: region.start, end: mid },
          { start: mid, end: region.end },
          ...finalRegions.slice(maxIndex + 1),
        ]
      }
    }

    // Create samples from regions
    const samples = finalRegions.map((region, i) => ({
      id: i,
      start: region.start,
      end: region.end,
      pitch: 0,
      speed: 1,
      vol: 80,
      phase: 0,
      delay: 0,
      rev: 0,
    }))

    setSamples(samples)
  }, [setSamples])

  const startRecording = useCallback(async () => {
    await resumeContext()

    // Mobile-optimized audio constraints
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: !isMobile, // Disable on mobile to prevent feedback
      noiseSuppression: !isMobile, // Disable on mobile to prevent processing artifacts
      autoGainControl: false, // Disable to prevent pumping/feedback
    }

    // On desktop, add sample rate
    if (!isMobile) {
      audioConstraints.sampleRate = 44100
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints
    })
    streamRef.current = stream

    // Determine best mime type
    let mimeType = 'audio/webm'
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus'
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4'
    } else if (MediaRecorder.isTypeSupported('audio/wav')) {
      mimeType = 'audio/wav'
    }

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    chunksRef.current = []
    transcriptRef.current = ''

    // Setup speech recognition (not supported on iOS Safari)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition && !isIOS) {
      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true

        // Try to detect Hebrew or use browser default
        // If the browser/system is set to Hebrew, it should auto-detect
        // We don't force a language to support multilingual input

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
          // Silently handle errors - transcription is optional
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.warn('Speech recognition:', event.error)
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
        recognition.start()
      } catch (e) {
        console.warn('Could not start speech recognition:', e)
        // Show fallback message for iOS
        if (isIOS) {
          setTranscript('(Transcription not available on iOS)')
        }
      }
    } else if (isIOS) {
      // iOS doesn't support Web Speech API
      setTranscript('(Tap to edit text)')
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

    // On mobile, don't use timeslice to avoid beeping/feedback issues
    // Collect all data at the end instead
    if (isMobile) {
      recorder.start()
    } else {
      // On desktop, use timeslice for longer recordings
      recorder.start(1000)
    }

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
    // Check if MediaRecorder is supported (for recording)
    return typeof MediaRecorder !== 'undefined'
  }, [])

  const isTranscriptionSupported = useCallback(() => {
    // iOS Safari doesn't support Web Speech API
    if (isIOS) return false
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }, [])

  return {
    startRecording,
    stopRecording,
    isRecordingSupported: isSupported,
    isTranscriptionSupported,
    isIOS,
    isMobile,
  }
}
