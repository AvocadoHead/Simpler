import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'

export function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioLevel = useStore((s) => s.audioLevel)
  const isRecording = useStore((s) => s.isRecording)
  const theme = useStore((s) => s.theme)
  const animationRef = useRef<number>(0)
  const historyRef = useRef<number[]>(new Array(64).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = canvas.width
    const centerX = size / 2
    const centerY = size / 2
    const baseRadius = size * 0.3
    const maxRadius = size * 0.45

    const draw = () => {
      // Update history with smooth interpolation
      historyRef.current.shift()
      historyRef.current.push(audioLevel)

      // Clear canvas
      ctx.clearRect(0, 0, size, size)

      // Colors based on theme
      const lineColor = theme === 'dark' ? '#4da6ff' : '#2563eb'
      const glowColor = theme === 'dark' ? 'rgba(77, 166, 255, 0.3)' : 'rgba(37, 99, 235, 0.2)'
      const bgColor = theme === 'dark' ? 'rgba(20, 24, 34, 0.6)' : 'rgba(255, 255, 255, 0.6)'

      // Draw background circle
      ctx.beginPath()
      ctx.arc(centerX, centerY, baseRadius + 10, 0, Math.PI * 2)
      ctx.fillStyle = bgColor
      ctx.fill()

      // Draw circular waveform
      ctx.beginPath()
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 2

      const numPoints = historyRef.current.length
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2
        const level = historyRef.current[i % numPoints] || 0
        const radius = baseRadius + level * (maxRadius - baseRadius) * 2

        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.closePath()

      // Add glow effect when recording
      if (isRecording && audioLevel > 0.05) {
        ctx.shadowColor = lineColor
        ctx.shadowBlur = 15 + audioLevel * 20
      } else {
        ctx.shadowBlur = 0
      }

      ctx.stroke()

      // Draw inner glow
      if (isRecording) {
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, baseRadius
        )
        gradient.addColorStop(0, glowColor)
        gradient.addColorStop(1, 'transparent')

        ctx.beginPath()
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Draw center dot
      ctx.beginPath()
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2)
      ctx.fillStyle = isRecording ? '#ff4d4d' : lineColor
      ctx.shadowBlur = isRecording ? 10 : 0
      ctx.shadowColor = '#ff4d4d'
      ctx.fill()
      ctx.shadowBlur = 0

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [audioLevel, isRecording, theme])

  return (
    <canvas
      ref={canvasRef}
      className="audio-visualizer"
      width={200}
      height={200}
    />
  )
}
