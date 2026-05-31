import { useMemo } from 'react'
import { LapInfo, Sample } from '../types'

/**
 * 从 samples 派生圈数据
 *
 * - DLAP：根据 lapNum 字段切分，每圈起点终点已经标好
 * - VBO：暂不支持（用户需手动标 start/finish 线，这一步以后做）
 */
export function useLaps(samples: Sample[], playheadT: number) {
  return useMemo(() => {
    if (samples.length === 0 || samples[0].lapNum == null) {
      return { laps: [] as LapInfo[], bestLap: null, currentLap: null }
    }

    // 按 lapNum 分组
    const byLap = new Map<number, Sample[]>()
    for (const s of samples) {
      const n = s.lapNum
      if (n == null) continue
      if (!byLap.has(n)) byLap.set(n, [])
      byLap.get(n)!.push(s)
    }

    const laps: LapInfo[] = []
    for (const [lapNum, arr] of byLap) {
      const start = arr[0]
      const end = arr[arr.length - 1]
      // dragy 的 lapTimeInLap（DLAP userTime × 1000）= 该 sample 距本圈过线的毫秒数
      // 所以 真实过线时刻 = sample.t - sample.lapTimeInLap
      // 用新圈第一个 sample 反推（精度 0~90ms 误差消除）
      const accurateStartT = start.lapTimeInLap != null
        ? start.t - start.lapTimeInLap
        : start.t
      // 该圈结束时刻 = 下一圈过线时刻（暂用本圈最后 sample 的 t + lapTimeInLap 之差的延伸）
      // 简化：endT 就用最后 sample 的 t；lapTime 用 dragy 给的"该圈终值 lapTimeInLap"更准
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

    // 计算有效计时圈：排除第 0 圈（出 pit/暖胎）和残缺圈（录制头尾的不完整片段）
    // 残缺圈判定：圈时明显短于正常圈。用所有 lapNum>0 圈时的中位数做基准，
    // 只保留圈时 >= 中位数 70% 的圈（残缺的最后一截、跑歪的 outlap 都会被剔除）
    const positiveLaps = laps.filter(l => l.lapNum > 0 && l.lapTime > 5)
    let valid: LapInfo[] = []
    if (positiveLaps.length > 0) {
      const times = positiveLaps.map(l => l.lapTime).sort((a, b) => a - b)
      const median = times[Math.floor(times.length / 2)]
      valid = positiveLaps.filter(l => l.lapTime >= median * 0.7 && l.lapTime <= median * 1.3)
      // 兜底：如果过滤后空了（圈时差异极大），退回原始正圈集合
      if (valid.length === 0) valid = positiveLaps
    }

    let bestLap: LapInfo | null = null
    if (valid.length > 0) {
      bestLap = valid.reduce((b, l) => l.lapTime < b.lapTime ? l : b, valid[0])
      bestLap.isBest = true
    }

    // 找当前圈
    let currentLap: LapInfo | null = null
    for (const l of laps) {
      if (playheadT >= l.startT && playheadT <= l.endT) {
        l.isCurrent = true
        currentLap = l
        break
      }
    }

    return { laps, bestLap, currentLap }
  }, [samples, playheadT])
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
