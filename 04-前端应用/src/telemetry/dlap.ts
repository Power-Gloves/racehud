/**
 * Dragy DLAP 文件解析器（浏览器版）
 * 从 02-数据解析/dlap.js 移植：crypto → Web Crypto API
 *
 * 文件结构：
 *   *.dlap (ZIP) → *.group (AES-128-CBC) → ZIP → *.cir (CSV) + data.json
 * 解密参数：
 *   key = "i2FleZnd" + \0×8, iv = "i3ev8len" + \0×8
 */
import JSZip from 'jszip'
import type { Sample, ParsedVbo } from '../types'

const KEY_BYTES = new Uint8Array(16)
KEY_BYTES.set(new TextEncoder().encode('i2FleZnd'))
const IV_BYTES = new Uint8Array(16)
IV_BYTES.set(new TextEncoder().encode('i3ev8len'))

let _cryptoKey: CryptoKey | null = null
async function getKey(): Promise<CryptoKey> {
  if (_cryptoKey) return _cryptoKey
  _cryptoKey = await crypto.subtle.importKey(
    'raw', KEY_BYTES, { name: 'AES-CBC' }, false, ['decrypt'],
  )
  return _cryptoKey
}

/** 解密 .group 文件字节流（AES-128-CBC + PKCS7） */
async function decryptGroup(encrypted: Uint8Array): Promise<Uint8Array> {
  const key = await getKey()
  // 拷贝到全新的 ArrayBuffer 避免 SharedArrayBuffer 类型问题
  const data = new Uint8Array(encrypted.byteLength)
  data.set(encrypted)
  const iv = new Uint8Array(IV_BYTES)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: iv as BufferSource },
    key,
    data as BufferSource,
  )
  return new Uint8Array(decrypted)
}

export async function parseDlap(dlapBuffer: ArrayBuffer | Uint8Array): Promise<ParsedVbo> {
  const buf = dlapBuffer instanceof Uint8Array ? dlapBuffer : new Uint8Array(dlapBuffer)

  // 第一层：解 ZIP 找 .group
  const outerZip = await JSZip.loadAsync(buf)
  const groupName = Object.keys(outerZip.files).find(n => n.endsWith('.group'))
  if (!groupName) throw new Error('DLAP 内未找到 .group 文件')
  const groupCipher = await outerZip.files[groupName].async('uint8array')

  // AES 解密
  const groupPlain = await decryptGroup(groupCipher)

  // 第二层：解密后又是 ZIP
  const innerZip = await JSZip.loadAsync(groupPlain)

  const inner: Record<string, { ext: string; file: JSZip.JSZipObject }> = {}
  for (const name of Object.keys(innerZip.files)) {
    const f = innerZip.files[name]
    if (f.dir) continue
    inner[name] = { ext: name.split('.').pop()!.toLowerCase(), file: f }
  }

  const dataEntry = Object.entries(inner).find(([, v]) => v.ext === 'cir' || v.ext === 'csv')
  const jsonEntry = Object.entries(inner).find(([, v]) => v.ext === 'json')
  if (!dataEntry) throw new Error('DLAP 解密后未找到 .cir / .csv 主数据')

  const csvText = await dataEntry[1].file.async('string')
  const jsonText = jsonEntry ? await jsonEntry[1].file.async('string') : null
  const jsonMeta = jsonText ? safeJson(jsonText) : null

  const baseEpochMs = jsonMeta?.createTime
    ? Math.round(jsonMeta.createTime * (jsonMeta.createTime < 1e12 ? 1000 : 1))
    : Date.now()

  const samples = parseCsv(csvText, baseEpochMs)
  if (samples.length < 2) throw new Error('DLAP CSV 数据点不足')
  enrichSamples(samples)
  const dt = samples[1].t - samples[0].t
  const sampleRate = dt > 0 ? Math.round(1000 / dt) : 0

  return {
    meta: {
      startTime: samples[0].t,
      endTime: samples[samples.length - 1].t,
      duration: samples[samples.length - 1].t - samples[0].t,
      model: jsonMeta?.deviceName || 'dragy',
      firmwareVersion: jsonMeta?.firmwareVersion?.replace(/\u0000/g, '') || null,
      source: 'dragy-dlap',
      columns: ['userTime', 'time', 'speed', 'acc', 'alt', 'lat', 'lng',
        'distance', 'accuracy', 'satelliteNum', 'heading',
        'brake', 'lastCompare', 'bestCompare', 'bestTime', 'idx'],
      sampleRate,
      count: samples.length,
      createTime: baseEpochMs,
    },
    samples,
    raw: { innerFiles: Object.keys(inner) },
  }
}

function parseCsv(text: string, baseEpochMs: number): Sample[] {
  const lines = text.split(/\r?\n/)
  const base = new Date(baseEpochMs)
  const dayStartUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0)
  const samples: Sample[] = []
  let firstUserTime: number | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(',')
    if (parts.length < 11) continue
    if (!/^[-+\d.]/.test(parts[0])) continue

    const userTime = parseFloat(parts[0])
    const timeUtcSec = parseFloat(parts[1])
    let t: number
    if (Number.isFinite(timeUtcSec) && timeUtcSec > 0) {
      t = dayStartUtc + Math.round(timeUtcSec * 1000)
      if (baseEpochMs - t > 12 * 3600 * 1000) t += 86400 * 1000
      else if (t - baseEpochMs > 12 * 3600 * 1000) t -= 86400 * 1000
    } else {
      if (firstUserTime === null) firstUserTime = userTime
      t = baseEpochMs + Math.round((userTime - firstUserTime) * 1000)
    }

    samples.push({
      t,
      lat: parseFloat(parts[5]),
      lng: parseFloat(parts[6]),
      speed: parseFloat(parts[2]),
      heading: parseFloat(parts[10]) || 0,
      altitude: parseFloat(parts[4]),
      sats: parseInt(parts[9], 10) || 0,
      accuracy: parseFloat(parts[8]) || 0,
      brake: parseFloat(parts[11]) || 0,
      accRaw: parseFloat(parts[3]) || 0,
      distanceRaw: parseFloat(parts[7]) || 0,
      lapNum: parseInt(parts[15], 10) || 0,
      lapTimeInLap: userTime * 1000,
      lastCompare: parseFloat(parts[12]) || 0,
      bestCompare: parseFloat(parts[13]) || 0,
      bestTime: parseFloat(parts[14]) || 0,
      acceleration: 0, gLong: 0, gLat: 0, distance: 0,
    })
  }
  return samples
}

interface DlapJsonMeta {
  createTime?: number
  deviceName?: string
  firmwareVersion?: string
}

function safeJson(s: string): DlapJsonMeta | null {
  try { return JSON.parse(s) as DlapJsonMeta } catch { return null }
}

function enrichSamples(samples: Sample[]): void {
  if (samples.length < 2) return
  const G = 9.80665

  // heading 兜底（DLAP 这一列恒为 0，从经纬度推算）
  const headingStd = stdDev(samples.map(s => s.heading || 0))
  if (headingStd < 1.0) {
    for (let i = 0; i < samples.length; i++) {
      const a = samples[Math.max(0, i - 1)]
      const b = samples[Math.min(samples.length - 1, i + 1)]
      samples[i].heading = bearing(a.lat, a.lng, b.lat, b.lng)
    }
  }

  let totalDist = 0
  for (let i = 0; i < samples.length; i++) {
    const cur = samples[i]
    if (i > 0) {
      const prev = samples[i - 1]
      totalDist += haversine(prev.lat, prev.lng, cur.lat, cur.lng)
      const dt = (cur.t - prev.t) / 1000
      const dv = (cur.speed - prev.speed) / 3.6
      cur.acceleration = dt > 0 ? dv / dt : 0
      cur.gLong = cur.acceleration / G
      const dh = angleDelta(prev.heading, cur.heading) * Math.PI / 180
      const omega = dt > 0 ? dh / dt : 0
      const v = cur.speed / 3.6
      cur.gLat = (v * omega) / G
    }
    cur.distance = totalDist
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const dφ = (lat2 - lat1) * Math.PI / 180, dλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
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

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length)
}
