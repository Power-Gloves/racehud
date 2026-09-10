/** 序列时间轴统一换算；所有偏移为毫秒，视频位置为秒。 */
export function videoToGps(videoSec: number, dataStart: number, dataOffset: number, videoOffset: number) {
  return dataStart + videoSec * 1000 + videoOffset - dataOffset
}

export function gpsToVideo(gpsT: number, dataStart: number, dataOffset: number, videoOffset: number) {
  return (gpsT - dataStart + dataOffset - videoOffset) / 1000
}

export function validateRange(startSec: number, endSec: number, duration: number) {
  if (![startSec, endSec, duration].every(Number.isFinite) || duration <= 0) throw new Error('导出时间无效')
  const start = Math.max(0, startSec), end = Math.min(duration, endSec)
  if (start >= end) throw new Error('导出范围与视频没有有效重叠，请检查对齐或起止时间')
  return { startSec: start, endSec: end }
}
