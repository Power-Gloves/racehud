/**
 * 视频 + HUD 导出引擎
 *
 * 流程：
 *   1. mediabunny.Input 解码原视频每一帧
 *   2. 在 OffscreenCanvas 上画：视频帧 + theme.drawHud(同一份预览代码)
 *   3. mediabunny.Output 把 canvas 帧 H.264 编码 → MP4
 *   4. 浏览器下载
 *
 * 关键：HUD 渲染复用主题的 drawHud(canvas, frame)，预览即导出。
 */
import {
  Input, Output, BlobSource, BufferTarget,
  ALL_FORMATS, Mp4OutputFormat,
  CanvasSource, AudioBufferSource,
  QUALITY_HIGH,
} from 'mediabunny'
import type { Theme, HudFrame } from '../themes'
import type { Sample, VboMeta, LapInfo } from '../types'

export interface ExportRange {
  /** 起点（视频内秒数） */
  startSec: number
  /** 终点（视频内秒数） */
  endSec: number
  /** 输出文件名 */
  filename: string
}

export interface ExportOptions {
  videoFile: File
  /** 视频时间到 GPS 数据时间的换算：gpsT = data.meta.startTime + (videoSec - videoBaseSec) * 1000 */
  videoOffsetMs: number
  dataOffsetMs: number
  data: { meta: VboMeta; samples: Sample[] }
  /** 派生 lap 信息（导出时不依赖 React，从外部传） */
  laps: LapInfo[]
  bestLap: LapInfo | null
  finishLine?: { a: { lat: number; lng: number }; b: { lat: number; lng: number } }
  unit?: 'kph' | 'mph'

  theme: Theme
  range: ExportRange

  /** 输出分辨率（不传则用原视频分辨率） */
  outputWidth?: number
  outputHeight?: number

  /** 进度回调 0~1 */
  onProgress?: (ratio: number) => void
  /** 取消信号 */
  signal?: AbortSignal
}

/** 启动一次导出。Promise resolve 时已下载。 */
export async function exportVideo(opts: ExportOptions): Promise<Blob> {
  const { videoFile, range, theme, onProgress, signal } = opts

  // 1. 打开输入视频
  const input = new Input({
    source: new BlobSource(videoFile),
    formats: ALL_FORMATS,
  })
  const videoTrack = await input.getPrimaryVideoTrack()
  if (!videoTrack) throw new Error('视频没有视频轨')
  const audioTrack = await input.getPrimaryAudioTrack()

  // 输出尺寸
  const W = opts.outputWidth ?? videoTrack.codedWidth
  const H = opts.outputHeight ?? videoTrack.codedHeight

  // 2. 准备渲染 canvas（用 OffscreenCanvas 性能更好；fallback 普通 canvas）
  let canvas: OffscreenCanvas | HTMLCanvasElement
  try {
    canvas = new OffscreenCanvas(W, H)
  } catch {
    canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
  }
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('无法创建 canvas 2d 上下文')

  // 3. 准备 mediabunny 输出
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  })
  const videoSource = new CanvasSource(canvas as HTMLCanvasElement, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
  })
  output.addVideoTrack(videoSource)

  // 音频直接转码（保留原音轨）
  let audioSource: AudioBufferSource | null = null
  if (audioTrack) {
    audioSource = new AudioBufferSource({
      codec: 'aac',
      numberOfChannels: audioTrack.numberOfChannels,
      sampleRate: audioTrack.sampleRate,
      bitrate: 128_000,
    })
    output.addAudioTrack(audioSource)
  }

  await output.start()

  // 4. 视频帧循环
  const totalSec = range.endSec - range.startSec
  let lastProgress = 0

  const videoSink = videoTrack.canvasSink ? videoTrack.canvasSink({ width: W, height: H }) : null

  // mediabunny 的帧迭代
  for await (const wrapped of videoTrack.canvases({
    startTimestamp: range.startSec,
    endTimestamp: range.endSec,
  })) {
    if (signal?.aborted) {
      await output.cancel()
      throw new Error('用户取消导出')
    }
    const { canvas: frameCanvas, timestamp } = wrapped

    // 画视频帧
    ctx.clearRect(0, 0, W, H)
    ;(ctx as CanvasRenderingContext2D).drawImage(frameCanvas as unknown as CanvasImageSource, 0, 0, W, H)

    // 画 HUD（用主题，跟预览一致）
    const gpsT = opts.data.meta.startTime + (timestamp * 1000 - opts.videoOffsetMs) + opts.dataOffsetMs
    const hudFrame = buildHudFrame(W, H, gpsT, opts)
    theme.drawHud(ctx as CanvasRenderingContext2D, hudFrame)

    await videoSource.add(timestamp, 1 / 60) // 帧时间戳 + 持续时间（粗略，实际由下一帧覆盖）

    const progress = (timestamp - range.startSec) / totalSec
    if (progress - lastProgress > 0.005) {
      onProgress?.(Math.max(0, Math.min(1, progress)))
      lastProgress = progress
    }
  }
  // 抑制未使用警告
  void videoSink

  // 5. 音频转码（直接复制）
  if (audioSource && audioTrack) {
    for await (const buf of audioTrack.audioBuffers({
      startTimestamp: range.startSec,
      endTimestamp: range.endSec,
    })) {
      if (signal?.aborted) {
        await output.cancel()
        throw new Error('用户取消导出')
      }
      await audioSource.add(buf.audioBuffer, buf.timestamp - range.startSec)
    }
  }

  await output.finalize()
  onProgress?.(1)

  const blob = new Blob([output.target.buffer!], { type: 'video/mp4' })
  return blob
}

/** 建议浏览器下载 blob 为指定文件名 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 在指定 GPS 时刻构造一个 HudFrame（不依赖 React 状态） */
function buildHudFrame(
  width: number, height: number,
  playheadT: number,
  opts: ExportOptions,
): HudFrame {
  const samples = opts.data.samples
  const current = findSampleAt(samples, playheadT)
  // current lap
  let currentLap: LapInfo | null = null
  for (const l of opts.laps) {
    if (playheadT >= l.startT && playheadT <= l.endT) { currentLap = l; break }
  }
  // 标 isCurrent
  const laps = opts.laps.map(l => ({ ...l, isCurrent: currentLap?.lapNum === l.lapNum }))
  return {
    width, height,
    current,
    samples,
    meta: opts.data.meta,
    playheadT,
    laps,
    bestLap: opts.bestLap,
    currentLap,
    finishLine: opts.finishLine,
    unit: opts.unit,
  }
}

function findSampleAt(samples: Sample[], t: number): Sample | null {
  if (samples.length === 0) return null
  if (t <= samples[0].t) return samples[0]
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1]
  let lo = 0, hi = samples.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= t) lo = mid
    else hi = mid
  }
  // 线性插值（跟 useLaps.interpolateSampleAt 一致逻辑，但导出场景简化）
  const a = samples[lo], b = samples[hi]
  const span = b.t - a.t
  if (span <= 0) return a
  const k = (t - a.t) / span
  return {
    ...a,
    t,
    lat: a.lat + (b.lat - a.lat) * k,
    lng: a.lng + (b.lng - a.lng) * k,
    speed: a.speed + (b.speed - a.speed) * k,
    heading: a.heading + (b.heading - a.heading) * k,
    altitude: a.altitude + (b.altitude - a.altitude) * k,
    sats: a.sats,
    acceleration: a.acceleration + (b.acceleration - a.acceleration) * k,
    gLong: a.gLong + (b.gLong - a.gLong) * k,
    gLat: a.gLat + (b.gLat - a.gLat) * k,
    distance: a.distance + (b.distance - a.distance) * k,
    lapNum: a.lapNum,
    lapTimeInLap: (a.lapTimeInLap ?? 0) + ((b.lapTimeInLap ?? 0) - (a.lapTimeInLap ?? 0)) * k,
    bestCompare: (a.bestCompare ?? 0) + ((b.bestCompare ?? 0) - (a.bestCompare ?? 0)) * k,
  }
}
