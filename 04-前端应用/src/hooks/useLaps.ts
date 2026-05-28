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

    // 第 0 圈通常是出 pit / 暖胎，不算计时圈
    // 最佳：取 lapNum > 0 且 lapTime > 5 秒（过滤异常）
    const valid = laps.filter(l => l.lapNum > 0 && l.lapTime > 5)
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
 * 二分找最近 sample
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
