import { useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { useAudioEngine } from './useAudioEngine'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

export function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const { resumeContext, getContext } = useAudioEngine()
  const setAudioBuffer = useStore((s) => s.setAudioBuffer)
  const setTranscript = useStore((s) => s.setTranscript)
  const setSamples = useStore((s) => s.setSamples)
  const setIsRecording = useStore((s) => s.setIsRecording)
  const setMode = useStore((s) => s.setMode)

  const autoSlice = useCallback((buffer: AudioBuffer, transcript: string) => {
    const duration = buffer.duration
    const safeDuration = duration * 0.9
    const startOffset = duration * 0.05

    const words = (transcript || 'a b c').trim().split(/\s+/).filter(Boolean)
    const count = Math.min(10, Math.max(1, words.length))
    const sliceLength = safeDuration / count

    const samples = []
    for (let i = 0; i < count; i++) {
      samples.push({
        id: i,
        start: startOffset + i * sliceLength,
        end: startOffset + (i + 1) * sliceLength - 0.05,
        pitch: 0,
        speed: 1,
        vol: 80,
        phase: 0,
        sus: 0.2,
        rev: 0,
      })
    }

    setSamples(samples)
  }, [setSamples])

  const startRecording = useCallback(async () => {
    await resumeContext()

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    chunksRef.current = []

    let currentTranscript = ''

    // Setup speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        currentTranscript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join('')
        setTranscript(currentTranscript)
      }
      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error)
      }
      recognitionRef.current = recognition
      recognition.start()
    }

    recorder.ondataavailable = (e) => {
      chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current)
      const ctx = getContext()
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = await ctx.decodeAudioData(arrayBuffer)

      setAudioBuffer(buffer)
      autoSlice(buffer, currentTranscript)
      setMode('edit')

      // Cleanup stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }

    recorder.start()
    setIsRecording(true)
  }, [resumeContext, getContext, setAudioBuffer, setTranscript, setSamples, setIsRecording, setMode, autoSlice])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
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
