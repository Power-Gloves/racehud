/**
 * Dragy / RaceLogic VBO 文件解析器（浏览器版）
 * 从 02-数据解析/vbo.js 移植，去掉 Node 依赖
 */
import type { Sample, ParsedVbo } from '../types'

export function parseVbo(text: string): ParsedVbo {
  // 按 section 切分（[xxx] 行）
  const sections: Record<string, string[]> = {}
  let currentSection: string | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const m = line.match(/^\[(.+?)\]$/)
    if (m) {
      currentSection = m[1].toLowerCase()
      sections[currentSection] = []
    } else if (currentSection) {
      sections[currentSection].push(rawLine)
    }
  }

  if (!sections['data']) throw new Error('VBO 缺少 [data] 段')
  if (!sections['column names']) throw new Error('VBO 缺少 [column names] 段')

  const columns = sections['column names'][0].trim().split(/\s+/)

  // 从 [comments] 解析 UTC 起始日期
  let startDateUtc: number | null = null
  let model = 'unknown'
  let source = 'dragy'
  if (sections['comments']) {
    for (const line of sections['comments']) {
      const dateMatch = line.match(/UTC Date Started:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})/)
      if (dateMatch) {
        const [, dd, mm, yyyy, hh, mi] = dateMatch
        startDateUtc = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, 0)
      }
      const modelMatch = line.match(/Model:\s*(.+)/)
      if (modelMatch) model = modelMatch[1].trim()
      if (/dragy/i.test(line)) source = 'dragy'
    }
  }

  const idx = {
    sats: columns.indexOf('sats'),
    time: columns.indexOf('time'),
    lat: columns.indexOf('lat'),
    lng: columns.indexOf('long'),
    speed: columns.indexOf('velocity'),
    heading: columns.indexOf('heading'),
    height: columns.indexOf('height'),
  }

  const raw: Sample[] = []
  for (const line of sections['data']) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < columns.length) continue
    const t = parseVboTime(parts[idx.time], startDateUtc)
    if (t === null) continue
    const latMin = parseFloat(parts[idx.lat])
    const lngMin = parseFloat(parts[idx.lng])
    raw.push({
      t,
      lat: latMin / 60,
      lng: -lngMin / 60, // VBO west=positive，取反
      speed: parseFloat(parts[idx.speed]),
      heading: parseFloat(parts[idx.heading]),
      altitude: parseFloat(parts[idx.height]),
      sats: parseInt(parts[idx.sats], 10),
      acceleration: 0, gLong: 0, gLat: 0, distance: 0,
    })
  }

  if (raw.length < 2) throw new Error('VBO 数据点不足')
  const dt = raw[1].t - raw[0].t
  const sampleRate = dt > 0 ? Math.round(1000 / dt) : 0
  enrichSamples(raw)

  return {
    meta: {
      startTime: raw[0].t,
      endTime: raw[raw.length - 1].t,
      duration: raw[raw.length - 1].t - raw[0].t,
      model,
      source,
      columns,
      sampleRate,
      count: raw.length,
    },
    samples: raw,
  }
}

function parseVboTime(s: string, baseDateUtc: number | null): number | null {
  const m = s.match(/^(\d{2})(\d{2})(\d{2})(?:\.(\d+))?$/)
  if (!m) return null
  const [, hh, mm, ss, frac] = m
  const ms = frac ? parseInt((frac + '000').slice(0, 3), 10) : 0
  const dayMs = (+hh) * 3600000 + (+mm) * 60000 + (+ss) * 1000 + ms
  if (baseDateUtc !== null) {
    const date = new Date(baseDateUtc)
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0) + dayMs
  }
  return dayMs
}

function enrichSamples(samples: Sample[]): void {
  const G = 9.80665
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

function angleDelta(a: number, b: number): number {
  let d = b - a
  while (d > 180) d -= 360
  while (d <= -180) d += 360
  return d
}
