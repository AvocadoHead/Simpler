import { useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useAudioEngine } from './useAudioEngine'
import { convertToSolfege, wordsFromTranscript } from '../utils/solfege'
import { detectDevice, getBestRecorderMimeType, getRecordingErrorMessage } from '../utils/recording'

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

const { isIOS, isMobile } = detectDevice()

// Normalize audio buffer to boost quiet recordings
function normalizeAudio(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate)

  // Find peak amplitude
  let maxAmp = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > maxAmp) maxAmp = abs
    }
  }

  // Don't normalize if already loud enough or silent
  if (maxAmp > 0.5 || maxAmp < 0.001) return buffer

  // Calculate gain to reach 0.9 peak
  const gain = 0.9 / maxAmp

  // Apply gain to all channels
  const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const oldData = buffer.getChannelData(ch)
    const newData = newBuffer.getChannelData(ch)
    for (let i = 0; i < oldData.length; i++) {
      newData[i] = oldData[i] * gain
    }
  }

  return newBuffer
}

// Find sound regions in audio
function findSoundRegions(
  buffer: AudioBuffer,
  options: { silenceThreshold?: number; minSoundDuration?: number; paddingMs?: number } = {}
): Array<{ start: number; end: number }> {
  const { silenceThreshold = 0.015, minSoundDuration = 0.05, paddingMs = 10 } = options

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
  for (const region of soundRegions) {
    if (mergedRegions.length === 0) {
      mergedRegions.push(region)
    } else {
      const last = mergedRegions[mergedRegions.length - 1]
      if (region.start - last.end < 0.08) {
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

  const { getContext } = useAudioEngine()
  const setAudioBuffer = useStore((s) => s.setAudioBuffer)
  const setTranscript = useStore((s) => s.setTranscript)
  const setSamples = useStore((s) => s.setSamples)
  const setIsRecording = useStore((s) => s.setIsRecording)
  const setMode = useStore((s) => s.setMode)
  const setRecorderStatus = useStore((s) => s.setRecorderStatus)
  const setRecorderError = useStore((s) => s.setRecorderError)

  const smartAutoSlice = useCallback((buffer: AudioBuffer, transcript: string) => {
    const words = wordsFromTranscript(transcript)
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
    setRecorderStatus('starting')
    setRecorderError(null)
    setIsRecording(true)
    setTranscript(isMobile ? '' : 'Listening...')
    transcriptRef.current = ''

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support microphone recording.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: isMobile ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        } : {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      })
      streamRef.current = stream

      const mimeType = getBestRecorderMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder))
      const recorderOptions = mimeType ? { mimeType } : undefined
      const recorder = new MediaRecorder(stream, recorderOptions)
      recorderRef.current = recorder
      chunksRef.current = []

      // Live speech recognition stays desktop-only. On mobile, it can compete with
      // MediaRecorder for the mic and crash/stop recording, so lyrics dictation is
      // offered after recording in the editor instead.
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      if (SpeechRecognition && !isMobile) {
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
            if (rawText) {
              transcriptRef.current = convertToSolfege(rawText)
              setTranscript(transcriptRef.current)
            }
          }

          recognition.onerror = () => {}

          recognition.onend = () => {
            if (recorderRef.current?.state === 'recording') {
              try { recognition.start() } catch {}
            }
          }

          recognitionRef.current = recognition
          recognition.start()
        } catch {
          recognitionRef.current = null
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        setRecorderStatus('processing')
        if (recognitionRef.current) {
          try { recognitionRef.current.stop() } catch {}
          recognitionRef.current = null
        }

        const blob = new Blob(chunksRef.current, { type: mimeType || undefined })
        const audioCtx = getContext()

        try {
          if (blob.size === 0) {
            throw new Error('No audio was captured. Please try again.')
          }

          const arrayBuffer = await blob.arrayBuffer()
          let buffer = await audioCtx.decodeAudioData(arrayBuffer)

          buffer = normalizeAudio(buffer)

          setAudioBuffer(buffer)
          smartAutoSlice(buffer, transcriptRef.current)
          setMode('edit')
          setRecorderStatus('idle')
          setRecorderError(null)
        } catch (error) {
          const message = getRecordingErrorMessage(error)
          console.error('Error processing audio:', error)
          setRecorderStatus('error')
          setRecorderError(message)
        } finally {
          setIsRecording(false)
          recorderRef.current = null
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, isMobile ? 500 : 100))
      recorder.start()
      setRecorderStatus('recording')
    } catch (error) {
      const message = getRecordingErrorMessage(error)
      console.error('Error starting recording:', error)
      setRecorderStatus('error')
      setRecorderError(message)
      setIsRecording(false)
      recorderRef.current = null
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [getContext, setAudioBuffer, setTranscript, setIsRecording, setMode, setRecorderStatus, setRecorderError, smartAutoSlice])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      setRecorderStatus('processing')
      recorderRef.current.stop()
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    setIsRecording(false)
  }, [setIsRecording, setRecorderStatus])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return { startRecording, stopRecording, isIOS, isMobile }
}
