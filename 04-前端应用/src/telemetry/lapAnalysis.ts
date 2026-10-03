import type { ComparableLap } from './lapCompare'

export interface AnalysisPoint {
  distance: number
  timeA: number
  timeB: number
  speedA: number
  speedB: number
  delta: number
  separation: number
}

export interface LapAnalysis {
  points: AnalysisPoint[]
  lengthA: number
  lengthB: number
  alignment: 'position' | 'progress' | 'invalid'
  warning: string
}

interface ProfilePoint { distance: number; time: number; speed: number; x: number; y: number }

/** A 为参考圈。时间差来自对应赛道位置的到达时间，不能用同一经过时间相减。 */
export function buildLapAnalysis(a: ComparableLap, b: ComparableLap): LapAnalysis {
  if (!a.samples.length || !b.samples.length) return { points: [], lengthA: 0, lengthB: 0, alignment: 'invalid', warning: 'GPS 数据为空，无法计算秒差。仍可按时间回放视频。' }
  const lat0 = a.samples[0].lat
  const lng0 = a.samples[0].lng
  const cos = Math.cos(lat0 * Math.PI / 180)
  const profile = (lap: ComparableLap) => lap.samples.map(s => ({
    distance: s.distance - lap.samples[0].distance,
    time: (s.t - lap.lap.startT) / 1000,
    speed: s.speed,
    x: (s.lng - lng0) * 111195 * cos,
    y: (s.lat - lat0) * 111195,
  }))
  const pa = profile(a), pb = profile(b)
  const lengthA = pa[pa.length - 1]?.distance ?? 0
  const lengthB = pb[pb.length - 1]?.distance ?? 0
  const valid = (p: ProfilePoint[]) => p.length >= 2 && p.every((v, i) =>
    Object.values(v).every(Number.isFinite) && (i === 0 || (v.distance >= p[i - 1].distance && v.time >= p[i - 1].time)))
  if (!valid(pa) || !valid(pb) || lengthA <= 0 || lengthB <= 0) {
    return { points: [], lengthA, lengthB, alignment: 'invalid', warning: '距离或 GPS 数据无效，无法可靠计算秒差。仍可按时间回放视频。' }
  }
  // 固定距离采样限定运算量，避免长视频分析遍历所有轨迹组合。
  const count = 600
  const reference = Array.from({ length: count + 1 }, (_, i) => sampleProfile(pa, lengthA * i / count))
  const comparison = Array.from({ length: count + 1 }, (_, i) => sampleProfile(pb, lengthB * i / count))
  let previous = 0
  const points = reference.map((r, i): AnalysisPoint => {
    let matched = comparison[i]
    let bestScore = Infinity
    if (i > 0 && i < count) {
      const prevA = reference[i - 1], nextA = reference[i + 1]
      const ax = nextA.x - prevA.x, ay = nextA.y - prevA.y
      const lower = Math.max(0, Math.floor(i - count * .1), Math.floor(previous))
      const upper = Math.min(count - 1, Math.ceil(i + count * .1))
      for (let j = lower; j <= upper; j++) {
        const start = comparison[j], end = comparison[j + 1]
        const dx = end.x - start.x, dy = end.y - start.y
        const square = dx * dx + dy * dy
        if (square < 1e-8) continue
        let f = Math.max(0, Math.min(1, ((r.x - start.x) * dx + (r.y - start.y) * dy) / square))
        if (j + f < previous) f = Math.min(1, previous - j)
        const x = start.x + dx * f, y = start.y + dy * f
        // 限制进度窗口并考虑方向，避免发卡弯或邻近直道匹配到另一条赛段。
        const cosine = (ax * dx + ay * dy) / (Math.hypot(ax, ay) * Math.sqrt(square) || 1)
        const score = (r.x - x) ** 2 + (r.y - y) ** 2 + 16 * (1 - cosine)
        if (score < bestScore) {
          bestScore = score
          matched = blend(start, end, f)
        }
      }
    }
    if (matched.distance / lengthB * count < previous) matched = sampleProfile(pb, lengthB * previous / count)
    previous = Math.max(previous, matched.distance / lengthB * count)
    return point(r, matched)
  })
  const errors = points.map(p => p.separation).sort((x, y) => x - y)
  const mismatch = errors[Math.floor(errors.length * .5)] > 20 || errors[Math.floor(errors.length * .95)] > 50 ||
    Math.max(lengthA, lengthB) / Math.min(lengthA, lengthB) > 1.5
  if (mismatch) {
    return { points: reference.map((r, i) => point(r, comparison[i])), lengthA, lengthB, alignment: 'progress',
      warning: '两条轨迹的位置匹配偏差较大，已按各圈距离比例估算秒差；请检查起跑线、GPS 和赛道是否一致。' }
  }
  return { points, lengthA, lengthB, alignment: 'position', warning: '' }
}

function point(a: ProfilePoint, b: ProfilePoint): AnalysisPoint {
  return { distance: a.distance, timeA: a.time, timeB: b.time, speedA: a.speed, speedB: b.speed,
    delta: b.time - a.time, separation: Math.hypot(a.x - b.x, a.y - b.y) }
}

function blend(a: ProfilePoint, b: ProfilePoint, f: number): ProfilePoint {
  const lerp = (x: number, y: number) => x + (y - x) * f
  return { distance: lerp(a.distance, b.distance), time: lerp(a.time, b.time), speed: lerp(a.speed, b.speed), x: lerp(a.x, b.x), y: lerp(a.y, b.y) }
}

function sampleProfile(points: ProfilePoint[], distance: number): ProfilePoint {
  if (distance <= 0) return points[0]
  if (distance >= points[points.length - 1].distance) return points[points.length - 1]
  let lo = 0, hi = points.length - 1
  while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (points[mid].distance < distance) lo = mid; else hi = mid }
  const span = points[hi].distance - points[lo].distance
  return blend(points[lo], points[hi], span > 0 ? (distance - points[lo].distance) / span : 0)
}

/** 图表游标和视频回放共用同一份插值结果。 */
export function analysisAt(analysis: LapAnalysis, value: number, axis: 'distance' | 'timeA' = 'distance'): AnalysisPoint | null {
  const points = analysis.points
  if (!points.length || !Number.isFinite(value)) return null
  if (value <= points[0][axis]) return points[0]
  if (value >= points[points.length - 1][axis]) return points[points.length - 1]
  let lo = 0, hi = points.length - 1
  while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (points[mid][axis] <= value) lo = mid; else hi = mid }
  const span = points[hi][axis] - points[lo][axis]
  const f = span > 0 ? (value - points[lo][axis]) / span : 0
  const result = {} as AnalysisPoint
  for (const key of Object.keys(points[lo]) as (keyof AnalysisPoint)[]) result[key] = points[lo][key] + (points[hi][key] - points[lo][key]) * f
  return result
}
