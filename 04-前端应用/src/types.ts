// 与后端 02-数据解析 输出对齐
export interface Sample {
  t: number
  lat: number
  lng: number
  speed: number
  heading: number
  altitude: number
  sats: number
  acceleration: number
  gLong: number
  gLat: number
  distance: number
  // DLAP 独有（VBO 不会出现）
  lapNum?: number
  lapTimeInLap?: number
  bestTime?: number
  lastCompare?: number
  bestCompare?: number
  accuracy?: number
  brake?: number
  accRaw?: number
  distanceRaw?: number
}

export interface VboMeta {
  startTime: number
  endTime: number
  duration: number
  model: string
  source: string                  // 'dragy' | 'dragy-dlap'
  columns: string[]
  sampleRate: number
  count: number
  firmwareVersion?: string | null
  createTime?: number
}

export interface ParsedVbo {
  meta: VboMeta
  samples: Sample[]
  raw?: { innerFiles?: string[] }
}

/** 派生圈数据 */
export interface LapInfo {
  lapNum: number
  startT: number       // 绝对时间 ms
  endT: number
  lapTime: number      // 秒
  isBest: boolean
  isCurrent: boolean   // 是否包含当前 playhead
}

