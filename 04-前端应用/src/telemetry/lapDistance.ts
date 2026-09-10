import type { Sample } from '../types'

/** 从全程累计 GPS 路径距离读取圈边界，避免跨圈采样点被漏算或重复计入。 */
function distanceAt(samples: Sample[], t: number) {
  if (t <= samples[0].t) return samples[0].distance
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1].distance
  let lo = 0, hi = samples.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = samples[lo], b = samples[hi]
  const fraction = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0
  return a.distance + (b.distance - a.distance) * fraction
}

export function measureLapDistance(samples: Sample[], startT: number, endT: number, currentT = endT) {
  if (samples.length < 2 || ![startT, endT, currentT].every(Number.isFinite) || endT <= startT) return null
  const start = Math.max(startT, samples[0].t)
  const end = Math.min(endT, samples[samples.length - 1].t)
  if (end <= start) return null
  const startDistance = distanceAt(samples, start)
  const meters = distanceAt(samples, end) - startDistance
  const travelledMeters = distanceAt(samples, Math.max(start, Math.min(end, currentT))) - startDistance
  if (![meters, travelledMeters].every(Number.isFinite) || meters < 0 || travelledMeters < 0) return null
  return { meters, travelledMeters }
}
