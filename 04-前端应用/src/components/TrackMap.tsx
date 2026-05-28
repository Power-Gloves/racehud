import { useEffect, useRef } from 'react'
import { Sample } from '../types'

interface Props {
  samples: Sample[]
  /** 当前视频帧对应的绝对时间戳 ms，会在轨迹上画一个高亮点 */
  cursorT?: number | null
}

/**
 * 轨迹图：经纬度 + 速度上色
 * 不依赖地图瓦片（先做最小可视化），后续可换 Leaflet/Mapbox
 */
export default function TrackMap({ samples, cursorT }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || samples.length === 0) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width = canvas.clientWidth * devicePixelRatio
    const H = canvas.height = canvas.clientHeight * devicePixelRatio

    let minLat = Infinity, maxLat = -Infinity
    let minLng = Infinity, maxLng = -Infinity
    for (const s of samples) {
      if (s.lat < minLat) minLat = s.lat
      if (s.lat > maxLat) maxLat = s.lat
      if (s.lng < minLng) minLng = s.lng
      if (s.lng > maxLng) maxLng = s.lng
    }
    const pad = 20 * devicePixelRatio
    const dLat = maxLat - minLat || 1e-6
    const dLng = maxLng - minLng || 1e-6
    // 等比缩放
    const scale = Math.min((W - pad * 2) / dLng, (H - pad * 2) / dLat)
    const offX = (W - dLng * scale) / 2
    const offY = (H - dLat * scale) / 2

    const project = (lat: number, lng: number): [number, number] => [
      offX + (lng - minLng) * scale,
      offY + (maxLat - lat) * scale,
    ]

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // 速度上色
    const maxV = Math.max(...samples.map(s => s.speed))
    ctx.lineWidth = 2 * devicePixelRatio
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]
      const b = samples[i]
      const v = (a.speed + b.speed) / 2
      const t = Math.min(1, v / Math.max(maxV, 1))
      // 蓝→黄→红
      const hue = (1 - t) * 220
      ctx.strokeStyle = `hsl(${hue}, 80%, 55%)`
      const [x1, y1] = project(a.lat, a.lng)
      const [x2, y2] = project(b.lat, b.lng)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    // 起点/终点
    const [sx, sy] = project(samples[0].lat, samples[0].lng)
    const [ex, ey] = project(samples[samples.length - 1].lat, samples[samples.length - 1].lng)
    drawDot(ctx, sx, sy, '#22c55e', '起点')
    drawDot(ctx, ex, ey, '#ef4444', '终点')

    // 当前游标位置（视频驱动）
    if (cursorT != null) {
      // 二分找最近的 sample
      let lo = 0, hi = samples.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (samples[mid].t < cursorT) lo = mid + 1
        else hi = mid
      }
      const s = samples[lo]
      if (s.t >= samples[0].t && s.t <= samples[samples.length - 1].t) {
        const [cx, cy] = project(s.lat, s.lng)
        // 外圈光晕
        ctx.strokeStyle = '#22d3ee'
        ctx.lineWidth = 2 * devicePixelRatio
        ctx.beginPath()
        ctx.arc(cx, cy, 9 * devicePixelRatio, 0, Math.PI * 2)
        ctx.stroke()
        // 中心
        ctx.fillStyle = '#22d3ee'
        ctx.beginPath()
        ctx.arc(cx, cy, 4 * devicePixelRatio, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [samples, cursorT])

  return <canvas ref={ref} className="w-full h-[300px]" />

  function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, 5 * devicePixelRatio, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `${11 * devicePixelRatio}px sans-serif`
    ctx.fillText(label, x + 8 * devicePixelRatio, y + 4 * devicePixelRatio)
  }
}
