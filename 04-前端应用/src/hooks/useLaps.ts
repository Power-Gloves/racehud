import { useMemo } from 'react'
import { LapInfo, Sample } from '../types'

/**
 * 从 samples 派生圈数据
 *
 * - DLAP：根据 lapNum 字段切分，每圈起点终点已经标好
 * - 内嵌 GPS / VBO：使用自动分圈后写入的 lapNum
 */
export function deriveLaps(samples: Sample[]) {
  if (samples.length === 0 || samples[0].lapNum == null) {
    return { laps: [] as LapInfo[], bestLap: null as LapInfo | null }
  }

  // 每圈只需要首尾采样，不复制整圈点数组。
  const byLap = new Map<number, { first: Sample; last: Sample }>()
  for (const s of samples) {
    const n = s.lapNum
    if (n == null) continue
    const entry = byLap.get(n)
    if (entry) entry.last = s
    else byLap.set(n, { first: s, last: s })
  }

  const laps: LapInfo[] = []
  for (const [lapNum, { first: start, last: end }] of byLap) {
    // Dragy 的 lapTimeInLap 是当前采样点距本圈起点的毫秒数。
    const accurateStartT = start.lapTimeInLap != null
      ? start.t - start.lapTimeInLap
      : start.t
    const accurateLapTime = end.lapTimeInLap != null && end.lapTimeInLap > 0
      ? end.lapTimeInLap / 1000
      : (end.t - start.t) / 1000
    laps.push({
      lapNum,
      startT: accurateStartT,
      endT: end.t,
      lapTime: accurateLapTime,
      isBest: false,
      isCurrent: false,
    })
  }
  laps.sort((a, b) => a.lapNum - b.lapNum)

  // 相邻圈的过线时间是完整圈边界，不能用最后一个采样点代替。
  for (let i = 0; i < laps.length - 1; i++) {
    laps[i].endT = laps[i + 1].startT
    laps[i].lapTime = (laps[i].endT - laps[i].startT) / 1000
  }
  // 最后一段没有结束过线证据；首段若起点早于录制，也是不完整圈。
  const valid = laps.slice(0, -1).filter(l => l.lapNum > 0 && l.lapTime > 0 && l.startT >= samples[0].t)

  let bestLap: LapInfo | null = null
  if (valid.length > 0) {
    bestLap = valid.reduce((b, l) => l.lapTime < b.lapTime ? l : b, valid[0])
    bestLap.isBest = true
  }

  return { laps, bestLap }
}

const EMPTY_SAMPLES: Sample[] = []

export function useLaps(samples: Sample[] = EMPTY_SAMPLES, playheadT: number) {
  const derived = useMemo(() => deriveLaps(samples), [samples])
  return useMemo(() => {
    const index = derived.laps.findIndex(l => playheadT >= l.startT && playheadT < l.endT)
    if (index < 0) return { ...derived, baseLaps: derived.laps, currentLap: null }
    const laps = derived.laps.map((lap, i) => i === index ? { ...lap, isCurrent: true } : lap)
    return { laps, baseLaps: derived.laps, bestLap: derived.bestLap?.lapNum === laps[index].lapNum ? laps[index] : derived.bestLap, currentLap: laps[index] }
  }, [derived, playheadT])
}

/**
 * 二分找最近 sample（圈号判定等场景用，不做插值）
 */
export function findSampleNear(samples: Sample[], t: number): Sample | null {
  if (samples.length === 0) return null
  let lo = 0, hi = samples.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t < t) lo = mid + 1
    else hi = mid
  }
  return samples[lo]
}

/**
 * 在两个相邻 sample 之间按时间线性插值，让数字按视频帧率平滑过渡而不是 10Hz 跳变。
 * heading 用最短角差插值；圈号 / 标志位等离散字段不插值（取左侧 sample）。
 */
export function interpolateSampleAt(samples: Sample[], t: number): Sample | null {
  if (samples.length === 0) return null
  if (t <= samples[0].t) return samples[0]
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1]

  // 二分找 i 满足 samples[i].t <= t < samples[i+1].t
  let lo = 0, hi = samples.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const span = b.t - a.t
  if (span <= 0) return a
  const k = (t - a.t) / span
  const lerp = (x: number, y: number) => x + (y - x) * k
  const lerpAngle = (x: number, y: number) => {
    let d = y - x
    while (d > 180) d -= 360
    while (d < -180) d += 360
    return ((x + d * k) % 360 + 360) % 360
  }
  const lerpOpt = (x: number | undefined, y: number | undefined): number | undefined => {
    if (x == null || y == null) return x ?? y
    return lerp(x, y)
  }

  return {
    t,
    lat: lerp(a.lat, b.lat),
    lng: lerp(a.lng, b.lng),
    speed: lerp(a.speed, b.speed),
    heading: lerpAngle(a.heading, b.heading),
    altitude: lerp(a.altitude, b.altitude),
    sats: a.sats,
    acceleration: lerp(a.acceleration, b.acceleration),
    gLong: lerp(a.gLong, b.gLong),
    gLat: lerp(a.gLat, b.gLat),
    distance: lerp(a.distance, b.distance),
    // DLAP 独有字段
    lapNum: a.lapNum,
    // lapTimeInLap 在同圈内单调递增可插值；跨圈处用 a 值避免突变
    lapTimeInLap: a.lapNum === b.lapNum && a.lapTimeInLap != null && b.lapTimeInLap != null && b.lapTimeInLap > a.lapTimeInLap
      ? lerp(a.lapTimeInLap, b.lapTimeInLap)
      : a.lapTimeInLap,
    bestTime: a.bestTime,
    lastCompare: lerpOpt(a.lastCompare, b.lastCompare),
    bestCompare: lerpOpt(a.bestCompare, b.bestCompare),
    accuracy: lerpOpt(a.accuracy, b.accuracy),
    brake: a.brake,
    accRaw: lerpOpt(a.accRaw, b.accRaw),
    distanceRaw: lerpOpt(a.distanceRaw, b.distanceRaw),
  }
}
