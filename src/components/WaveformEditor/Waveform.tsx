import { useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'

export function Waveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioBuffer = useStore((s) => s.audioBuffer)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !audioBuffer) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight
      canvas.width = width
      canvas.height = height

      ctx.clearRect(0, 0, width, height)

      const data = audioBuffer.getChannelData(0)
      const step = Math.ceil(data.length / width)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'

      for (let i = 0; i < width; i++) {
        let min = 1
        let max = -1

        for (let j = 0; j < step; j++) {
          const datum = data[i * step + j]
          if (datum < min) min = datum
          if (datum > max) max = datum
        }

        const y = (1 + min) * (height / 2)
        const barHeight = Math.max(1, (max - min) * (height / 2))
        ctx.fillRect(i, y, 1, barHeight)
      }
    }

    draw()

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)

    return () => resizeObserver.disconnect()
  }, [audioBuffer])

  return <canvas ref={canvasRef} className="waveform-canvas" />
}
