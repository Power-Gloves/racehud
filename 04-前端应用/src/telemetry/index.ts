/**
 * 遥测/自动对齐统一出口
 */
import { DjiExtractor } from './djiExtractor'
import { GoProExtractor } from './goproExtractor'
import { alignAccel, accelFromSamples } from './align'
import { parseVbo } from './vbo'
import { parseDlap } from './dlap'
import type { VideoTelemetryExtractor, VideoTelemetry, AlignResult, AccelSignal } from './types'
import type { ParsedVbo } from '../types'

export * from './types'
export { alignAccel, accelFromSamples, parseVbo, parseDlap }

/**
 * 统一前端解析 .vbo / .dlap 文件
 * 按扩展名派发到对应解析器（纯前端，无后端依赖）。
 */
export async function parseTelemetryFile(file: File): Promise<ParsedVbo> {
  const ext = file.name.toLowerCase().split('.').pop() || ''
  if (ext === 'vbo') {
    const text = await file.text()
    return parseVbo(text)
  }
  if (ext === 'dlap') {
    const buf = await file.arrayBuffer()
    return parseDlap(buf)
  }
  throw new Error(`不支持的扩展名: ${ext}`)
}

/** 已注册的视频遥测提取器（按优先级探测） */
const EXTRACTORS: VideoTelemetryExtractor[] = [
  new GoProExtractor(),
  new DjiExtractor(),
]

/** 探测并提取视频内嵌遥测，返回 null 表示该视频无可识别遥测 */
export async function extractVideoTelemetry(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<VideoTelemetry | null> {
  for (const ex of EXTRACTORS) {
    if (await ex.probe(file)) {
      return ex.extract(file, onProgress)
    }
  }
  return null
}

export interface AutoSyncResult extends AlignResult {
  /** 视频遥测信息（型号等），供 UI 展示 */
  videoTelemetry: VideoTelemetry
}

/**
 * 自动对齐：从视频提取加速度，与数据侧加速度互相关。
 * @param videoFile 视频文件
 * @param dataSamples 外部数据（DLAP/VBO）的统一 Sample[]
 * @returns 对齐结果（含 lagSeconds），或 null（视频无遥测）
 */
export async function autoSync(
  videoFile: File,
  dataSamples: { t: number; acceleration?: number; gLong?: number; gLat?: number; speed: number }[],
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<AutoSyncResult | null> {
  const vt = await extractVideoTelemetry(videoFile, onProgress)
  if (signal?.aborted) throw new Error('已取消对齐')
  if (!vt) return null

  const dataAccel: AccelSignal = accelFromSamples(dataSamples)
  const result = await new Promise<AlignResult>((resolve, reject) => {
    const worker = new Worker(new URL('./align.worker.ts', import.meta.url), { type: 'module' })
    const abort = () => { worker.terminate(); reject(new Error('已取消对齐')) }
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }) => {
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      if (data.error) reject(new Error(data.error))
      else resolve(data.result)
    }
    worker.onerror = (event) => { signal?.removeEventListener('abort', abort); worker.terminate(); reject(new Error(event.message)) }
    worker.postMessage({ video: vt.accel, data: dataAccel })
  })

  return { ...result, videoTelemetry: vt }
}
