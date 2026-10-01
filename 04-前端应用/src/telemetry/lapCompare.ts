import type { LapInfo, Sample } from '../types'
import { interpolateSampleAt } from '../hooks/useLaps'
import { gpsToVideo } from './time'

export interface ComparableLap {
  lap: LapInfo
  samples: Sample[]
  videoStartSec: number
  videoEndSec: number
}

/** 对比只接受有下一次冲线证据、完整 GPS 覆盖及完整视频覆盖的圈。 */
export function getComparableLaps(
  samples: Sample[], laps: LapInfo[], videoDuration: number,
  dataStartT: number, dataOffsetMs: number, videoOffsetMs: number,
): ComparableLap[] {
  if (samples.length < 2 || !Number.isFinite(videoDuration) || videoDuration <= 0) return []
  return laps.flatMap((lap, index) => {
    if (index === laps.length - 1 || lap.lapNum <= 0 || lap.endT <= lap.startT ||
      lap.startT < samples[0].t || lap.endT > samples[samples.length - 1].t) return []
    const videoStartSec = gpsToVideo(lap.startT, dataStartT, dataOffsetMs, videoOffsetMs)
    const videoEndSec = gpsToVideo(lap.endT, dataStartT, dataOffsetMs, videoOffsetMs)
    if (videoStartSec < 0 || videoEndSec > videoDuration || videoEndSec <= videoStartSec) return []
    const first = lowerBound(samples, lap.startT)
    const last = lowerBound(samples, lap.endT)
    const start = interpolateSampleAt(samples, lap.startT)
    const end = interpolateSampleAt(samples, lap.endT)
    if (!start || !end) return []
    const points = [start, ...samples.slice(first, last).filter(s => s.t > lap.startT && s.t < lap.endT), end]
    return [{ lap, samples: points, videoStartSec, videoEndSec }]
  })
}

function lowerBound(samples: Sample[], t: number) {
  let lo = 0, hi = samples.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (samples[mid].t < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function compareTimeAt(lap: ComparableLap, elapsedSec: number) {
  return Math.min(lap.videoEndSec, lap.videoStartSec + Math.max(0, elapsedSec))
}
