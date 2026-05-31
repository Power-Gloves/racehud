/**
 * GoPro 视频内嵌遥测提取器（前端，File.slice 按需读取）
 *
 * 支持 HERO5+ 的 GPMF 格式：
 *   - gpmd track（handler=meta, format=gpmd）
 *   - 每个样本是一个 GPMF KLV 块（覆盖约 1 秒），内含多个 STRM
 *   - GPS9（HERO11+）或 GPS5（更早）→ 经纬度/速度
 *   - ACCL → 加速度（对齐用）
 *
 * 输出：
 *   - accel：高频加速度模长（对齐用）
 *   - samples：完整 Sample[]（GPS+速度+G），可直接当数据源（场景3）
 */
import {
  readBytes, parseTopLevelBoxes, parseTracks, findBox, findBoxes, type SampleTable, type Box,
} from './mp4'
import { parseGpmfPayload, gpmfHasFourCC } from './gpmf'
import type { VideoTelemetry, VideoTelemetryExtractor, AccelSignal, VideoSample } from './types'

export class GoProExtractor implements VideoTelemetryExtractor {
  async probe(file: File): Promise<boolean> {
    try {
      const boxes = await parseTopLevelBoxes(file)
      const moov = boxes.find(b => b.type === 'moov')
      if (!moov) return false
      const moovBuf = await readBytes(file, moov.offset, Math.min(moov.size, 4 * 1024 * 1024))
      const tracks = parseTracks(moovBuf, moov.headerSize, moovBuf.length)
      const gpmd = tracks.find(t => t.format === 'gpmd')
      if (!gpmd || gpmd.offsets.length === 0) return false
      // 读第一个样本确认含 GPMF（DEVC 头）
      const first = await readBytes(file, gpmd.offsets[0], Math.min(gpmd.sizes[0], 64 * 1024))
      return gpmfHasFourCC(first, 'DEVC')
    } catch {
      return false
    }
  }

  async extract(file: File, onProgress?: (r: number) => void): Promise<VideoTelemetry> {
    const boxes = await parseTopLevelBoxes(file)
    const moov = boxes.find(b => b.type === 'moov')
    if (!moov) throw new Error('GoPro: 未找到 moov box')
    const moovBuf = await readBytes(file, moov.offset, moov.size)

    // 找 gpmd track 的样本表 + 时间信息（mdhd timescale + stts）
    const gpmd = parseTracks(moovBuf, moov.headerSize, moovBuf.length).find(t => t.format === 'gpmd')
    if (!gpmd) throw new Error('GoPro: 未找到 gpmd 遥测 track')
    const timing = parseGpmdTiming(moovBuf, moov.headerSize, moovBuf.length)

    // 设备型号
    let model = 'GoPro'
    {
      const head = await readBytes(file, gpmd.offsets[0], Math.min(gpmd.sizes[0], 64 * 1024))
      const m = bytesToAscii(head).match(/HERO\s?\d+\s?(Black|White|Silver)?/i)
      if (m) model = m[0].trim()
    }

    // 逐样本解析。每个 gpmd 样本覆盖 [sampleStartSec, +sampleDurSec)
    const n = gpmd.offsets.length
    const wanted = new Set(['GPS9', 'GPS5', 'ACCL'])

    const accT: number[] = []
    const accMag: number[] = []
    const samples: VideoSample[] = []

    // GPS UTC 基准（从 GPS9 的 days/secs 推），用于给 samples 一个绝对时间
    let utcBaseMs: number | null = null

    // 滑动窗口读
    const WIN = 8 * 1024 * 1024
    let winStart = -1
    let winBuf = new Uint8Array(0)
    const getSample = async (o: number, len: number): Promise<Uint8Array> => {
      if (winStart < 0 || o < winStart || o + len > winStart + winBuf.length) {
        winStart = o
        winBuf = await readBytes(file, o, Math.max(WIN, len))
      }
      return winBuf.subarray(o - winStart, o - winStart + len)
    }

    for (let i = 0; i < n; i++) {
      const buf = await getSample(gpmd.offsets[i], gpmd.sizes[i])
      const sampleStartSec = timing.sampleStartSec(i)
      const sampleDurSec = timing.sampleDurSec(i)
      const streams = parseGpmfPayload(buf, wanted)

      // --- 加速度（对齐用，高频）---
      const acclStream = streams['ACCL']
      if (acclStream && acclStream.samples.length) {
        const cnt = acclStream.samples.length
        for (let k = 0; k < cnt; k++) {
          const a = acclStream.samples[k]
          if (a.length >= 3) {
            accMag.push(Math.hypot(a[0], a[1], a[2]))
            accT.push(sampleStartSec + (sampleDurSec * k) / cnt)
          }
        }
      }

      // --- GPS（数据源用，~10-18Hz）---
      const gpsStream = streams['GPS9'] ?? streams['GPS5']
      const isGps9 = !!streams['GPS9']
      if (gpsStream && gpsStream.samples.length) {
        const cnt = gpsStream.samples.length
        for (let k = 0; k < cnt; k++) {
          const g = gpsStream.samples[k]
          // GPS9: [lat,lng,alt,spd2d,spd3d,days,secs,dop,fix]
          // GPS5: [lat,lng,alt,spd2d,spd3d]
          const lat = g[0], lng = g[1], alt = g[2], spd2d = g[3]
          // UTC 基准：GPS9 的 days(从2000-01-01) + secs
          if (utcBaseMs === null && isGps9 && g.length >= 7) {
            const days = g[5], secs = g[6]
            const epoch2000 = Date.UTC(2000, 0, 1)
            utcBaseMs = epoch2000 + days * 86400_000 + secs * 1000 - sampleStartSec * 1000
          }
          const tSec = sampleStartSec + (sampleDurSec * k) / cnt
          samples.push({
            t: (utcBaseMs ?? 0) + tSec * 1000,
            lat, lng,
            speed: spd2d * 3.6, // m/s → km/h
            heading: 0,         // 后面用经纬度差分补
            altitude: alt,
            sats: 0,
            acceleration: 0, gLong: 0, gLat: 0, distance: 0,
          })
        }
      }
      if (onProgress && (i & 15) === 0) onProgress(i / n)
    }
    onProgress?.(1)

    // 派生：heading（经纬度方位角）/ distance / G
    enrichVideoSamples(samples)

    const durationSec = accT.length ? accT[accT.length - 1] - accT[0] : timing.totalSec
    const rate = accMag.length > 1 && durationSec > 0 ? (accMag.length - 1) / durationSec : 200
    const accel: AccelSignal = { t: accT, mag: accMag, rate, source: 'gopro' }

    return {
      device: 'gopro',
      model,
      accel,
      hasGps: samples.length > 0,
      durationSec: timing.totalSec,
      sampleCount: samples.length,
      samples: samples.length ? samples : undefined,
    }
  }
}

/** gpmd track 时间信息：每个样本的起始秒/时长（用 mdhd timescale + stts） */
interface GpmdTiming {
  totalSec: number
  sampleStartSec: (i: number) => number
  sampleDurSec: (i: number) => number
}

function parseGpmdTiming(moov: Uint8Array, start: number, end: number): GpmdTiming {
  // 找 gpmd track 的 mdhd(timescale) + stts(每样本时长)
  const traks = findBoxes(moov, start, end, 'trak')
  for (const trak of traks) {
    const mdia = findBox(moov, trak.offset + trak.headerSize, trak.offset + trak.size, 'mdia')
    if (!mdia) continue
    const minf = findBox(moov, mdia.offset + mdia.headerSize, mdia.offset + mdia.size, 'minf')
    if (!minf) continue
    const stbl = findBox(moov, minf.offset + minf.headerSize, minf.offset + minf.size, 'stbl')
    if (!stbl) continue
    const stsd = findBox(moov, stbl.offset + stbl.headerSize, stbl.offset + stbl.size, 'stsd')
    const fmt = stsd ? asciiAtBuf(moov, stsd.offset + stsd.headerSize + 12, 4) : ''
    if (fmt !== 'gpmd') continue

    const dv = new DataView(moov.buffer, moov.byteOffset)
    const mdhd = findBox(moov, mdia.offset + mdia.headerSize, mdia.offset + mdia.size, 'mdhd')!
    const timescale = dv.getUint32(mdhd.offset + mdhd.headerSize + 12)
    const stts = findBox(moov, stbl.offset + stbl.headerSize, stbl.offset + stbl.size, 'stts')!
    const base = stts.offset + stts.headerSize
    const nent = dv.getUint32(base + 4)
    const entries: { count: number; delta: number }[] = []
    for (let i = 0; i < nent; i++) {
      entries.push({ count: dv.getUint32(base + 8 + i * 8), delta: dv.getUint32(base + 8 + i * 8 + 4) })
    }
    // 展开每个样本的累计起始时间
    const starts: number[] = []
    let acc = 0
    for (const e of entries) {
      for (let c = 0; c < e.count; c++) { starts.push(acc / timescale); acc += e.delta }
    }
    const totalSec = acc / timescale
    const durOf = (i: number) => {
      const a = starts[i] ?? 0
      const b = i + 1 < starts.length ? starts[i + 1] : totalSec
      return Math.max(0, b - a)
    }
    return {
      totalSec,
      sampleStartSec: (i) => starts[i] ?? 0,
      sampleDurSec: durOf,
    }
  }
  // 兜底：假设每样本 1 秒
  return { totalSec: 0, sampleStartSec: (i) => i, sampleDurSec: () => 1 }
}

/** 派生 heading / distance / 加速度 / G（与 dlap.js enrichSamples 思路一致） */
function enrichVideoSamples(s: VideoSample[]) {
  if (s.length < 2) return
  const G = 9.80665
  // heading：中心差分方位角
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)]
    const b = s[Math.min(s.length - 1, i + 1)]
    s[i].heading = bearing(a.lat, a.lng, b.lat, b.lng)
  }
  let dist = 0
  for (let i = 0; i < s.length; i++) {
    const cur = s[i]
    if (i > 0) {
      const prev = s[i - 1]
      dist += haversine(prev.lat, prev.lng, cur.lat, cur.lng)
      const dt = (cur.t - prev.t) / 1000
      const dv = (cur.speed - prev.speed) / 3.6
      cur.acceleration = dt > 0 ? dv / dt : 0
      cur.gLong = cur.acceleration / G
      const dh = angleDelta(prev.heading, cur.heading) * Math.PI / 180
      const omega = dt > 0 ? dh / dt : 0
      const v = cur.speed / 3.6
      cur.gLat = (v * omega) / G
    }
    cur.distance = dist
  }
}

function haversine(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371000, toR = Math.PI / 180
  const dLa = (la2 - la1) * toR, dLo = (lo2 - lo1) * toR
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * toR) * Math.cos(la2 * toR) * Math.sin(dLo / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
function bearing(la1: number, lo1: number, la2: number, lo2: number): number {
  const toR = Math.PI / 180
  const φ1 = la1 * toR, φ2 = la2 * toR, Δλ = (lo2 - lo1) * toR
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}
function angleDelta(a: number, b: number): number {
  let d = b - a
  while (d > 180) d -= 360
  while (d <= -180) d += 360
  return d
}

function bytesToAscii(buf: Uint8Array): string {
  let s = ''
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i]
    s += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : ' '
  }
  return s
}
function asciiAtBuf(buf: Uint8Array, off: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(buf[off + i])
  return s
}

// 避免未使用告警（Box/SampleTable 类型供阅读参考）
export type { SampleTable, Box }
