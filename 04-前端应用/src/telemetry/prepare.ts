import type { ParsedVbo } from '../types'
import { autoDetectLaps } from './autoLap'

/** 所有来源共用分圈入口，保留原始设备数据，允许恢复。 */
export function prepareTelemetry(raw: ParsedVbo, position: number | null) {
  const samples = raw.samples.map(s => ({ ...s, lapNum: undefined, lapTimeInLap: undefined, bestCompare: undefined }))
  const nativeLaps = raw.samples.some(s => s.lapNum != null && s.lapNum > 0)
  // 设备模式下用首次圈号变化附近的位置显示原始起跑线。
  const transition = raw.samples.findIndex((s, i) => i > 0 && s.lapNum !== raw.samples[i - 1].lapNum)
  const info = autoDetectLaps(samples, {
    trackPosition: position,
    referenceIndex: nativeLaps && position === null && transition > 0 ? transition : undefined,
  })
  return {
    data: nativeLaps && position === null ? raw : { ...raw, samples },
    finishLine: samples.length >= 50 ? info.finishLine : null,
    lapCount: info.lapCount,
  }
}
