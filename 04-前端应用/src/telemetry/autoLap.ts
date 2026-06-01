/**
 * GPS 轨迹自动分圈（用于无圈号的数据源，如 GoPro）
 *
 * 算法（已用真实 GoPro 数据验证，10 圈圈时 44.1~46.4s 高度一致）：
 *   1. 经纬度 → 米制局部坐标
 *   2. 选起跑线参考点（默认自动；可由用户用"沿轨迹位置 0~1"覆盖）
 *   3. 过线检测：车的移动段与"过参考点、垂直于行进方向的检测线"做线段相交，
 *      要求同向 + 防抖间隔
 *   4. 相邻过线时刻之差 = 圈时
 *
 * 输出：给每个 sample 标注 lapNum + lapTimeInLap，与 DLAP 字段语义一致；
 *      额外返回终点线两端经纬度坐标，供 MiniMap 可视化。
 */

export interface LapSample {
  t: number       // 绝对 ms
  lat: number
  lng: number
  speed: number   // km/h
  lapNum?: number
  lapTimeInLap?: number
  bestCompare?: number  // 实时与最佳圈相同位置的秒差（< 0 = 快，> 0 = 慢）
}

export interface AutoLapResult {
  /** 过线时刻（绝对 ms），长度 = 圈数+1 */
  crossings: number[]
  /** 检测到的完整圈数 */
  lapCount: number
  /** 起跑线参考点在 samples 数组里的索引 */
  refIndex: number
  /** 终点线两端的经纬度（用于 MiniMap 画线） */
  finishLine: { a: { lat: number; lng: number }; b: { lat: number; lng: number } }
}

export interface AutoLapOptions {
  /** 起跑线沿轨迹的相对位置 0~1。null/undefined = 自动选 */
  trackPosition?: number | null
  /** 检测线半宽（米），默认 15 */
  halfWidth?: number
}

/**
 * 自动分圈：原地给 samples 写入 lapNum / lapTimeInLap。
 */
export function autoDetectLaps<T extends LapSample>(
  samples: T[],
  opts: AutoLapOptions = {},
): AutoLapResult {
  const n = samples.length
  const W = opts.halfWidth ?? 15
  const empty: AutoLapResult = {
    crossings: [], lapCount: 0, refIndex: 0,
    finishLine: { a: { lat: 0, lng: 0 }, b: { lat: 0, lng: 0 } },
  }
  if (n < 50) return empty

  // 1. 米制局部坐标
  const R = 6371000, toR = Math.PI / 180
  const lat0 = samples[0].lat
  const lng0 = samples[0].lng
  const mPerLat = R * toR
  const mPerLng = R * toR * Math.cos(lat0 * toR)
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    xs[i] = (samples[i].lng - lng0) * mPerLng
    ys[i] = (samples[i].lat - lat0) * mPerLat
  }

  // 2. 选起跑线参考点
  let refIdx: number
  if (opts.trackPosition != null) {
    // 用户指定：沿轨迹位置 0~1，跳过首尾各 5%（pit 区）
    const p = Math.max(0, Math.min(1, opts.trackPosition))
    const lo = Math.floor(n * 0.05)
    const hi = Math.floor(n * 0.95)
    refIdx = lo + Math.round(p * (hi - lo))
  } else {
    // 自动：跳过首尾 10%，找第一个高于平均速度的点
    const avgSpd = samples.reduce((s, p) => s + p.speed, 0) / n
    const skip = Math.floor(n * 0.1)
    refIdx = -1
    for (let i = skip; i < n - skip; i++) {
      if (samples[i].speed > avgSpd) { refIdx = i; break }
    }
    if (refIdx < 0) refIdx = Math.floor(n / 2)
  }

  // 参考点行进方向（用前后 3 点中心差分更稳）
  const a = Math.max(0, refIdx - 3)
  const b = Math.min(n - 1, refIdx + 3)
  const dx = xs[b] - xs[a]
  const dy = ys[b] - ys[a]
  const dlen = Math.hypot(dx, dy) || 1
  const dirX = dx / dlen, dirY = dy / dlen

  // 检测线两端
  const nx = -dirY, ny = dirX
  const refX = xs[refIdx], refY = ys[refIdx]
  const lineA = { x: refX + nx * W, y: refY + ny * W }
  const lineB = { x: refX - nx * W, y: refY - ny * W }

  // 经纬度反算（线两端供 MiniMap 用）
  const finishLine = {
    a: { lat: lat0 + lineA.y / mPerLat, lng: lng0 + lineA.x / mPerLng },
    b: { lat: lat0 + lineB.y / mPerLat, lng: lng0 + lineB.x / mPerLng },
  }

  // 3. 过线检测
  const crossings: number[] = []
  let lastCrossIdx = -1000
  for (let i = 1; i < n; i++) {
    if (i - lastCrossIdx < 20) continue
    const mvx = xs[i] - xs[i - 1]
    const mvy = ys[i] - ys[i - 1]
    const mvlen = Math.hypot(mvx, mvy)
    if (mvlen < 0.5) continue
    const dot = (mvx * dirX + mvy * dirY) / mvlen
    if (dot < 0.3) continue
    const p1 = { x: xs[i - 1], y: ys[i - 1] }
    const p2 = { x: xs[i], y: ys[i] }
    if (segIntersect(p1, p2, lineA, lineB)) {
      crossings.push(samples[i].t)
      lastCrossIdx = i
    }
  }

  // 4. 标注 lapNum / lapTimeInLap
  if (crossings.length < 2) {
    for (const s of samples) { s.lapNum = 0; s.lapTimeInLap = 0 }
    return { crossings, lapCount: 0, refIndex: refIdx, finishLine }
  }

  for (const s of samples) {
    let lapNum = 0
    let lapStartT = crossings[0]
    if (s.t < crossings[0]) {
      lapNum = 0
      lapStartT = samples[0].t
    } else {
      let k = 0
      while (k < crossings.length - 1 && s.t >= crossings[k + 1]) k++
      if (s.t >= crossings[crossings.length - 1]) {
        lapNum = crossings.length
        lapStartT = crossings[crossings.length - 1]
      } else {
        lapNum = k + 1
        lapStartT = crossings[k]
      }
    }
    s.lapNum = lapNum
    s.lapTimeInLap = Math.max(0, s.t - lapStartT)
  }

  // 5. 实时秒差（bestCompare）：用"本圈累计距离"对齐到最佳圈
  computeBestCompare(samples, xs, ys, crossings)

  return { crossings, lapCount: crossings.length - 1, refIndex: refIdx, finishLine }
}

/**
 * 给每个 sample 写入 bestCompare。
 * 算法：
 *   1. 找最快完整圈（圈时最短）
 *   2. 算这一圈每个 sample 的"距起跑线累计米数 → 用时"映射表
 *   3. 对当前圈每个 sample，算自己跑了多远（米），到最佳圈对应距离查"应该用多少秒"
 *   4. 当前用时（lapTimeInLap）- 最佳应用时 = bestCompare
 */
function computeBestCompare<T extends LapSample>(
  samples: T[],
  xs: Float64Array,
  ys: Float64Array,
  crossings: number[],
): void {
  if (crossings.length < 2) return

  // 按 lapNum 分组采样索引
  type LapIdx = { lapNum: number; indices: number[]; lapTime: number }
  const lapMap = new Map<number, number[]>()
  for (let i = 0; i < samples.length; i++) {
    const n = samples[i].lapNum ?? 0
    if (n <= 0) continue
    if (!lapMap.has(n)) lapMap.set(n, [])
    lapMap.get(n)!.push(i)
  }
  const laps: LapIdx[] = []
  for (const [num, indices] of lapMap) {
    if (indices.length < 10) continue
    const first = samples[indices[0]]
    const last = samples[indices[indices.length - 1]]
    const lapTime = (last.t - first.t) / 1000 + (first.lapTimeInLap ?? 0) / 1000
    laps.push({ lapNum: num, indices, lapTime })
  }
  if (laps.length === 0) return

  // 找最快圈（用中位数附近过滤离群圈，跟 useLaps 一致）
  const times = laps.map(l => l.lapTime).sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)]
  const valid = laps.filter(l => l.lapTime >= median * 0.7 && l.lapTime <= median * 1.3)
  const pool = valid.length > 0 ? valid : laps
  const best = pool.reduce((b, l) => l.lapTime < b.lapTime ? l : b, pool[0])

  // 算最佳圈的"距离 → 用时"映射（按本圈起点累计米）
  const bestDist: number[] = []   // 累计米
  const bestTime: number[] = []   // 本圈用时（秒）
  let acc = 0
  let prevIdx = -1
  for (const idx of best.indices) {
    if (prevIdx >= 0) {
      const dx = xs[idx] - xs[prevIdx]
      const dy = ys[idx] - ys[prevIdx]
      acc += Math.hypot(dx, dy)
    }
    bestDist.push(acc)
    bestTime.push((samples[idx].lapTimeInLap ?? 0) / 1000)
    prevIdx = idx
  }
  if (bestDist.length < 2) return

  /** 在最佳圈映射表里查指定距离对应的用时（线性插值） */
  function bestTimeAtDistance(d: number): number {
    if (d <= bestDist[0]) return bestTime[0]
    if (d >= bestDist[bestDist.length - 1]) return bestTime[bestTime.length - 1]
    // 二分
    let lo = 0, hi = bestDist.length - 1
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1
      if (bestDist[mid] <= d) lo = mid
      else hi = mid
    }
    const r = (d - bestDist[lo]) / (bestDist[hi] - bestDist[lo] || 1)
    return bestTime[lo] + (bestTime[hi] - bestTime[lo]) * r
  }

  // 对每一圈（含最佳本身）算每个 sample 的 bestCompare
  for (const lap of laps) {
    let dist = 0
    let prev = -1
    for (const idx of lap.indices) {
      if (prev >= 0) {
        const dx = xs[idx] - xs[prev]
        const dy = ys[idx] - ys[prev]
        dist += Math.hypot(dx, dy)
      }
      const curUsed = (samples[idx].lapTimeInLap ?? 0) / 1000
      const bestUsed = bestTimeAtDistance(dist)
      samples[idx].bestCompare = curUsed - bestUsed
      prev = idx
    }
  }
}

// 线段相交
function ccw(a: P, b: P, c: P): boolean {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)
}
function segIntersect(p1: P, p2: P, p3: P, p4: P): boolean {
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
}
interface P { x: number; y: number }
