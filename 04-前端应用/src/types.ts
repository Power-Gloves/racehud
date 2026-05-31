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

/** Widget 渲染上下文 — 所有 widget 共享的输入 */
export interface WidgetContext {
  /** 当前 playhead 对应的最近 sample */
  current: Sample | null
  /** 全量 samples（widget 想算自己的派生数据时用）*/
  samples: Sample[]
  /** 数据元信息 */
  meta: VboMeta
  /** 当前 playhead 绝对时间 ms */
  playheadT: number
  /** 派生：所有圈数据 */
  laps: LapInfo[]
  /** 派生：最快圈 */
  bestLap: LapInfo | null
  /** 派生：当前圈 */
  currentLap: LapInfo | null
  /** 自动分圈终点线两端经纬度（仅自动分圈数据源有，DLAP 没有） */
  finishLine?: { a: { lat: number; lng: number }; b: { lat: number; lng: number } }
}
