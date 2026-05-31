/**
 * 遥测/自动对齐统一出口
 */
import { DjiExtractor } from './djiExtractor'
import { GoProExtractor } from './goproExtractor'
import { alignAccel, accelFromSamples } from './align'
import type { VideoTelemetryExtractor, VideoTelemetry, AlignResult, AccelSignal } from './types'

export * from './types'
export { alignAccel, accelFromSamples }

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
): Promise<AutoSyncResult | null> {
  const vt = await extractVideoTelemetry(videoFile, onProgress)
  if (!vt) return null

  const dataAccel: AccelSignal = accelFromSamples(dataSamples)
  const result = alignAccel(vt.accel, dataAccel)

  return { ...result, videoTelemetry: vt }
}
