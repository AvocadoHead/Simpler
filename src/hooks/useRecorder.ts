import { useRef, useCallback, useEffect } from 'react'
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
const isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
)

// Detect mobile
const isMobile = typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// Solfège syllables mapping - convert common misheard words
const solfegeMap: Record<string, string> = {
  // Do variations
  'do': 'Do', 'doh': 'Do', 'doe': 'Do', 'though': 'Do', 'dough': 'Do',
  'door': 'Do', 'go': 'Do',
  // Re variations
  're': 'Re', 'ray': 'Re', 'rey': 'Re', 'rain': 'Re', 'way': 'Re',
  // Mi variations
  'mi': 'Mi', 'me': 'Mi', 'mee': 'Mi', 'knee': 'Mi',
  // Fa variations
  'fa': 'Fa', 'far': 'Fa', 'fah': 'Fa', 'for': 'Fa', 'four': 'Fa',
  // Sol variations
  'sol': 'Sol', 'so': 'Sol', 'sew': 'Sol', 'soul': 'Sol', 'sole': 'Sol',
  'saw': 'Sol', 'show': 'Sol',
  // La variations
  'la': 'La', 'lah': 'La', 'law': 'La', 'ma': 'La',
  // Si/Ti variations
  'si': 'Si', 'ti': 'Si', 'tea': 'Si', 'tee': 'Si', 'see': 'Si',
  'sea': 'Si', 'she': 'Si', 'key': 'Si', 'be': 'Si',
}

// Convert transcript to solfège where possible
function convertToSolfege(text: string): string {
  const words = text.toLowerCase().split(/\s+/)
  return words.map(word => {
    const clean = word.replace(/[.,!?]/g, '')
    return solfegeMap[clean] || word
  }).join(' ')
}

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
    minSoundDuration = 0.05,
    paddingMs = 10,
  } = options

  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const padding = paddingMs / 1000
  const windowSize = Math.floor(0.005 * sampleRate)
  const energies: number[] = []

  for (let i = 0; i < data.length; i += windowSize) {
    let sum = 0
    const end = Math.min(i + windowSize, data.length)
    for (let j = i; j < end; j++) {
      sum += data[j] * data[j]
    }
    energies.push(Math.sqrt(sum / (end - i)))
  }

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

  if (soundStart !== null) {
    const soundEnd = buffer.duration
    if (soundEnd - soundStart >= minSoundDuration) {
      soundRegions.push({
        start: Math.max(0, soundStart - padding),
        end: soundEnd,
      })
    }
  }

  // Merge close regions
  const mergedRegions: Array<{ start: number; end: number }> = []
  const mergeGap = 0.08

  for (const region of soundRegions) {
    if (mergedRegions.length === 0) {
      mergedRegions.push(region)
    } else {
      const last = mergedRegions[mergedRegions.length - 1]
      if (region.start - last.end < mergeGap) {
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

    let regions = findSoundRegions(buffer, {
      silenceThreshold: 0.012,
      minSoundDuration: 0.04,
      paddingMs: 8,
    })

    if (regions.length === 0) {
      regions = [{ start: 0, end: buffer.duration }]
    }

    let finalRegions = regions

    // Limit to 10 regions max
    if (regions.length > 10) {
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

        finalRegions = [
          ...finalRegions.slice(0, minIndex),
          { start: finalRegions[minIndex].start, end: finalRegions[minIndex + 1].end },
          ...finalRegions.slice(minIndex + 2),
        ]
      }
    } else if (regions.length < wordCount && wordCount <= 10 && regions.length > 0) {
      // Split large regions to match word count
      finalRegions = [...regions]

      while (finalRegions.length < Math.min(wordCount, 10)) {
        let maxDuration = 0
        let maxIndex = 0

        for (let i = 0; i < finalRegions.length; i++) {
          const duration = finalRegions[i].end - finalRegions[i].start
          if (duration > maxDuration) {
            maxDuration = duration
            maxIndex = i
          }
        }

        if (maxDuration < 0.2) break

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
    // Resume audio context first
    await resumeContext()

    // Longer delay on mobile to avoid system sound capture
    const delay = isMobile ? 300 : 100
    await new Promise(resolve => setTimeout(resolve, delay))

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }
    })
    streamRef.current = stream

    // Determine best mime type
    let mimeType = 'audio/webm'
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus'
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4'
    }

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    chunksRef.current = []
    transcriptRef.current = ''

    // Setup speech recognition - works on desktop and Android, not iOS
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (SpeechRecognition && !isIOS) {
      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

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

          const rawText = (finalTranscript + interimTranscript).trim()
          transcriptRef.current = convertToSolfege(rawText)
          setTranscript(transcriptRef.current)
        }

        recognition.onerror = () => {
          // Silent fail - transcription is optional
        }

        recognition.onend = () => {
          if (recorderRef.current?.state === 'recording') {
            try {
              recognition.start()
            } catch {
              // Already started
            }
          }
        }

        recognitionRef.current = recognition
        recognition.start()
      } catch {
        // Speech recognition not available
      }
    }

    // On iOS only, set empty transcript (no speech recognition support)
    if (isIOS) {
      setTranscript('')
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = async () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Already stopped
        }
      }

      const blob = new Blob(chunksRef.current, { type: mimeType })
      const audioCtx = getContext()

      try {
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = await audioCtx.decodeAudioData(arrayBuffer)

        setAudioBuffer(buffer)
        smartAutoSlice(buffer, transcriptRef.current)
        setMode('edit')
      } catch (error) {
        console.error('Error decoding audio:', error)
        alert('Error processing audio. Please try recording again.')
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }

    recorder.start()
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

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return {
    startRecording,
    stopRecording,
    isIOS,
    isMobile,
  }
}
