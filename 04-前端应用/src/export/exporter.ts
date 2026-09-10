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
  CanvasSource, AudioSampleSource, AudioSample,
  QUALITY_HIGH, canEncodeAudio,
  CanvasSink, AudioBufferSink,
} from 'mediabunny'
import { videoToGps, validateRange } from '../telemetry/time'
import { interpolateSampleAt } from '../hooks/useLaps'
import type { Theme, HudFrame } from '../themes'
import type { Sample, VboMeta, LapInfo } from '../types'
import { renderHud } from '../themes/render'
import { loadHudFonts } from '../themes/fonts'
import type { StartLightsCue } from '../themes/startLights'

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
  startLights?: StartLightsCue
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
  await loadHudFonts()
  const { videoFile, theme, onProgress, signal } = opts
  if (signal?.aborted) throw new Error('用户取消导出')

  // 1. 打开输入视频
  const input = new Input({
    source: new BlobSource(videoFile),
    formats: ALL_FORMATS,
  })
  try {
  const videoTrack = await input.getPrimaryVideoTrack()
  if (!videoTrack) throw new Error('视频没有视频轨')
  const range = validateRange(opts.range.startSec, opts.range.endSec, await input.computeDuration())
  const audioTrack = await input.getPrimaryAudioTrack()

  // 输出尺寸
  const W = opts.outputWidth ?? (await videoTrack.getDisplayWidth())
  const H = opts.outputHeight ?? (await videoTrack.getDisplayHeight())

  // HUD 设计尺寸固定为 1920×1080（与预览一致）
  const HUD_DESIGN_W = 1920
  const HUD_DESIGN_H = 1080

  // 2. 准备渲染 canvas（用 OffscreenCanvas 性能更好；fallback 普通 canvas）
  let canvas: OffscreenCanvas | HTMLCanvasElement
  try {
    canvas = new OffscreenCanvas(HUD_DESIGN_W, HUD_DESIGN_H)
  } catch {
    canvas = document.createElement('canvas')
    canvas.width = HUD_DESIGN_W
    canvas.height = HUD_DESIGN_H
  }
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('无法创建 canvas 2d 上下文')

  // 准备输出画布（目标分辨率）
  let outputCanvas: OffscreenCanvas | HTMLCanvasElement
  try {
    outputCanvas = new OffscreenCanvas(W, H)
  } catch {
    outputCanvas = document.createElement('canvas')
    outputCanvas.width = W
    outputCanvas.height = H
  }
  const outputCtx = outputCanvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!outputCtx) throw new Error('无法创建输出 canvas 2d 上下文')

  // 3. 准备 mediabunny 输出
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  })
  try {
  const videoSource = new CanvasSource(outputCanvas as HTMLCanvasElement, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
  })
  output.addVideoTrack(videoSource)

  // 音频直接转码（保留原音轨）
  let audioSource: AudioSampleSource | null = null
  if (audioTrack) {
    const audioConfig = { numberOfChannels: await audioTrack.getNumberOfChannels(), sampleRate: await audioTrack.getSampleRate(), bitrate: 128_000 }
    const codec = await canEncodeAudio('aac', audioConfig) ? 'aac' : await canEncodeAudio('opus', audioConfig) ? 'opus' : null
    if (!codec) throw new Error('当前浏览器无法编码音频，请更换支持 AAC 或 Opus 的浏览器')
    audioSource = new AudioSampleSource({
      codec,
      bitrate: 128_000,
    })
    output.addAudioTrack(audioSource)
  }

  await output.start()

  // 4. 视频帧循环
  const totalSec = range.endSec - range.startSec
  let lastProgress = 0
  let frameCount = 0

  // 创建 CanvasSink 用于解码视频帧
  const canvasSink = new CanvasSink(videoTrack, { 
    width: W, 
    height: H,
    fit: 'contain' // 添加 fit 选项：保持宽高比，contain 或 cover
  })

  // mediabunny 的帧迭代
  for await (const wrapped of canvasSink.canvases(range.startSec, range.endSec)) {
    if (signal?.aborted) {
      await output.cancel()
      throw new Error('用户取消导出')
    }
    const { canvas: frameCanvas, timestamp, duration } = wrapped

    const frameStart = Math.max(timestamp, range.startSec)
    const frameEnd = Math.min(timestamp + duration, range.endSec)
    if (frameEnd <= frameStart) continue
    frameCount++

    // 画视频帧到设计画布（1920×1080）
    ctx.clearRect(0, 0, HUD_DESIGN_W, HUD_DESIGN_H)
    ;(ctx as CanvasRenderingContext2D).drawImage(frameCanvas as unknown as CanvasImageSource, 0, 0, HUD_DESIGN_W, HUD_DESIGN_H)

    // 画 HUD（用主题，跟预览一致）- 固定使用设计尺寸
    const gpsT = videoToGps(frameStart, opts.data.meta.startTime, opts.dataOffsetMs, opts.videoOffsetMs)
    const hudFrame = buildHudFrame(HUD_DESIGN_W, HUD_DESIGN_H, gpsT, opts)
    renderHud(ctx as CanvasRenderingContext2D, theme, hudFrame)

    // 将设计画布缩放到目标分辨率
    outputCtx.clearRect(0, 0, W, H)
    ;(outputCtx as CanvasRenderingContext2D).drawImage(canvas as unknown as CanvasImageSource, 0, 0, W, H)

    // 使用相对时间戳（从第一帧开始计算，确保从0开始）
    const relativeTimestamp = frameStart - range.startSec
    await videoSource.add(relativeTimestamp, frameEnd - frameStart)

    const progress = (timestamp - range.startSec) / totalSec
    if (progress - lastProgress > 0.005) {
      onProgress?.(Math.max(0, Math.min(1, progress)))
      lastProgress = progress
    }
  }

  if (!frameCount) throw new Error('导出范围内没有可解码的视频帧')

  // 5. 音频使用同一裁剪起点，并裁掉首尾音频块的范围外采样。
  if (audioSource && audioTrack) {
    const audioBufferSink = new AudioBufferSink(audioTrack)
    for await (const wrapped of audioBufferSink.buffers(range.startSec, range.endSec)) {
      if (signal?.aborted) {
        await output.cancel()
        throw new Error('用户取消导出')
      }
      const { buffer, timestamp } = wrapped
      const first = Math.max(0, Math.ceil((range.startSec - timestamp) * buffer.sampleRate))
      const last = Math.min(buffer.length, Math.ceil((range.endSec - timestamp) * buffer.sampleRate))
      if (last <= first) continue
      const trimmed = new AudioBuffer({ length: last - first, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate })
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        trimmed.copyToChannel(buffer.getChannelData(channel).subarray(first, last), channel)
      }
      for (const sample of AudioSample.fromAudioBuffer(trimmed, Math.max(0, timestamp + first / buffer.sampleRate - range.startSec))) {
        try { await audioSource.add(sample) } finally { sample.close() }
      }
    }
  }

  if (signal?.aborted) throw new Error('用户取消导出')
  await output.finalize()
  onProgress?.(1)

  const blob = new Blob([output.target.buffer!], { type: 'video/mp4' })
  return blob
  } catch (e) {
    await output.cancel().catch(() => {})
    throw e
  }
  } finally {
    input.dispose()
  }
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
  const current = interpolateSampleAt(samples, playheadT)
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
    startLights: opts.startLights,
  }
}
