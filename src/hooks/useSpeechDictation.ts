import { useCallback, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { convertToSolfege } from '../utils/solfege'

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultList
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function useSpeechDictation(onTranscript?: (transcript: string) => void) {
  const [isDictating, setIsDictating] = useState(false)
  const [dictationError, setDictationError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const setTranscript = useStore((s) => s.setTranscript)

  const SpeechRecognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined
  const isSupported = Boolean(SpeechRecognition)

  const stopDictation = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsDictating(false)
  }, [])

  const commitTranscript = useCallback((rawText: string) => {
    const converted = convertToSolfege(rawText)
    setTranscript(converted)
    onTranscript?.(converted)
  }, [onTranscript, setTranscript])

  const startDictation = useCallback(() => {
    if (!SpeechRecognition) {
      setDictationError('Speech dictation is not supported in this browser.')
      return
    }

    stopDictation()
    setDictationError(null)
    setIsDictating(true)

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
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
        if (rawText) {
          commitTranscript(rawText)
        }
      }

      recognition.onerror = (event) => {
        setDictationError(event.error === 'not-allowed'
          ? 'Microphone permission was blocked for dictation.'
          : 'Dictation stopped. You can type lyrics manually.')
        setIsDictating(false)
      }

      recognition.onend = () => {
        setIsDictating(false)
        recognitionRef.current = null
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setDictationError('Could not start speech dictation. You can type lyrics manually.')
      setIsDictating(false)
      recognitionRef.current = null
    }
  }, [SpeechRecognition, commitTranscript, stopDictation])

  return {
    isDictating,
    dictationError,
    isSupported,
    startDictation,
    stopDictation,
  }
}
