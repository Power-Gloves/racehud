import { useMemo } from 'react'
import type { WidgetProps } from './index'

/**
 * 迷你赛道图：画当前圈/最佳圈完整赛道路径 + 当前位置点
 *
 * 策略：
 *   1. 优先用「最佳圈」轨迹作为底图（赛道图稳定，不随当前圈变化）
 *   2. 无最佳圈时用第一个完整圈
 *   3. VBO 无 lap 信息时回退到全部 samples
 */
export default function MiniMap({ ctx }: WidgetProps) {
  const { samples, current, bestLap } = ctx

  // 选取一圈样本作为赛道底图。
  // 按 lapNum 字段过滤。判据：点数最接近"正常单圈点数（中位数）"的圈——
  // 这样能避开 lapNum=0（暖胎多圈）、异常合并圈（多圈未分开）、录制末尾残缺圈。
  const trackSamples = useMemo(() => {
    if (samples.length === 0 || samples[0].lapNum == null) return samples

    // 按 lapNum 分组统计点数（排除 0 圈：通常是出 pit/暖胎）
    const counts = new Map<number, number>()
    for (const s of samples) {
      if (s.lapNum == null || s.lapNum <= 0) continue
      counts.set(s.lapNum, (counts.get(s.lapNum) ?? 0) + 1)
    }
    if (counts.size === 0) return samples

    // 正常单圈点数 = 各圈点数的中位数（抗异常圈干扰）
    const sortedCounts = [...counts.values()].sort((a, b) => a - b)
    const median = sortedCounts[Math.floor(sortedCounts.length / 2)]

    // 候选：优先最佳圈（前提它点数接近中位数 ±30%，确保是完整单圈）
    const bestNum = bestLap?.lapNum
    let targetNum: number | undefined
    if (bestNum != null) {
      const c = counts.get(bestNum) ?? 0
      if (c >= median * 0.7 && c <= median * 1.3) targetNum = bestNum
    }
    // 否则选点数最接近中位数的圈
    if (targetNum == null) {
      let bestDiff = Infinity
      for (const [num, c] of counts) {
        const diff = Math.abs(c - median)
        if (diff < bestDiff) { bestDiff = diff; targetNum = num }
      }
    }

    const filtered = samples.filter(s => s.lapNum === targetNum)
    return filtered.length > 10 ? filtered : samples
  }, [samples, bestLap])

  const { path, project } = useMemo(() => {
    if (trackSamples.length === 0) return { path: '', project: () => [0, 0] as [number, number] }
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
    for (const s of trackSamples) {
      if (s.lat < minLat) minLat = s.lat
      if (s.lat > maxLat) maxLat = s.lat
      if (s.lng < minLng) minLng = s.lng
      if (s.lng > maxLng) maxLng = s.lng
    }
    const dLat = maxLat - minLat || 1e-6
    const dLng = maxLng - minLng || 1e-6
    // 纬度校正：经度方向每度物理距离 = 纬度方向 × cos(lat)，
    // 否则赛道会被东西向拉伸变形（标准 equirectangular 投影）
    const midLat = (minLat + maxLat) / 2
    const cosLat = Math.cos((midLat * Math.PI) / 180)
    const wX = dLng * cosLat   // 东西向"宽度"（已校正）
    const hY = dLat            // 南北向"高度"
    const pad = 0.1
    const scale = (2 - pad * 2) / Math.max(wX, hY)
    const drawW = wX * scale
    const drawH = hY * scale
    const offX = -drawW / 2
    const offY = -drawH / 2
    const project = (lat: number, lng: number): [number, number] => [
      offX + (lng - minLng) * cosLat * scale,
      // SVG y 向下，纬度越高 y 越小，取反
      -(offY + (lat - minLat) * scale),
    ]
    const step = Math.max(1, Math.floor(trackSamples.length / 400))
    const parts: string[] = []
    for (let i = 0; i < trackSamples.length; i += step) {
      const [x, y] = project(trackSamples[i].lat, trackSamples[i].lng)
      parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`)
    }
    // 闭合首尾（赛道是回路）
    parts.push('Z')
    return { path: parts.join(' '), project }
  }, [trackSamples])

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
