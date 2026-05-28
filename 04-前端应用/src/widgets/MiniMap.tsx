import { useMemo } from 'react'
import type { WidgetProps } from './index'

/**
 * 迷你赛道图：画整个赛道路径 + 当前位置点
 */
export default function MiniMap({ ctx }: WidgetProps) {
  const { samples, current } = ctx

  const { path, project } = useMemo(() => {
    if (samples.length === 0) return { path: '', project: () => [0, 0] as [number, number] }
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
    for (const s of samples) {
      if (s.lat < minLat) minLat = s.lat
      if (s.lat > maxLat) maxLat = s.lat
      if (s.lng < minLng) minLng = s.lng
      if (s.lng > maxLng) maxLng = s.lng
    }
    const dLat = maxLat - minLat || 1e-6
    const dLng = maxLng - minLng || 1e-6
    const pad = 0.05
    const scale = (2 - pad * 2) / Math.max(dLat, dLng)
    const offX = -((dLng * scale) / 2)
    const offY = -((dLat * scale) / 2)
    const project = (lat: number, lng: number): [number, number] => [
      offX + (lng - minLng) * scale,
      -(offY + (lat - minLat) * scale),
    ]
    const step = Math.max(1, Math.floor(samples.length / 400))
    const parts: string[] = []
    for (let i = 0; i < samples.length; i += step) {
      const [x, y] = project(samples[i].lat, samples[i].lng)
      parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`)
    }
    return { path: parts.join(' '), project }
  }, [samples])

  const [cx, cy] = current ? project(current.lat, current.lng) : [NaN, NaN]

  return (
    <div className="hud-card flex flex-col p-1.5">
      <div className="hud-label px-1">Track</div>
      <svg viewBox="-1.05 -1.05 2.1 2.1" className="flex-1 w-full mt-0.5">
        <path d={path} fill="none" stroke="var(--hud-text-dim)" strokeWidth="0.05" strokeLinejoin="round" strokeLinecap="round" />
        {Number.isFinite(cx) && (
          <>
            <circle cx={cx} cy={cy} r="0.12" fill="none" stroke="var(--hud-accent)" strokeWidth="0.035" opacity="0.6" />
            <circle cx={cx} cy={cy} r="0.07" fill="var(--hud-accent)" />
          </>
        )}
      </svg>
    </div>
  )
}
