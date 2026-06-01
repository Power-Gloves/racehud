/**
 * Canvas 主题系统
 *
 * 一个主题 = 一个 Theme 对象，自己负责把整个 HUD 画到 canvas 上。
 * 同一份 drawHud 代码同时用于：屏幕实时预览 + 视频导出（保证所见即所得）
 *
 * 每周新增主题 = 加一个新的 Theme 对象，零其它代码改动。
 */
import type { Sample, VboMeta, LapInfo } from '../types'

/** 一帧的渲染上下文（主题画 HUD 时拿到的数据） */
export interface HudFrame {
  /** 画布尺寸（CSS 像素），主题用这个做布局 */
  width: number
  height: number

  /** 当前 playhead 时刻对应的采样（已插值，60fps 平滑） */
  current: Sample | null
  /** 全量采样（主题画轨迹/速度曲线时用） */
  samples: Sample[]
  /** 数据元信息 */
  meta: VboMeta
  /** 当前 playhead 绝对时间 ms */
  playheadT: number

  /** 派生的圈数据（DLAP 自带 / GoPro 自动分圈） */
  laps: LapInfo[]
  bestLap: LapInfo | null
  currentLap: LapInfo | null

  /** 自动分圈终点线（GoPro 等无圈号数据源有；DLAP 没有） */
  finishLine?: { a: { lat: number; lng: number }; b: { lat: number; lng: number } }

  /** 用户偏好（单位等） */
  unit?: 'kph' | 'mph'
}

/** 主题预览色块（缩略图用） */
export interface ThemePreview {
  bg: string
  border: string
  text: string
  accent: string
}

/**
 * 主题接口：每个主题实现 drawHud。
 * 函数职责：把整个 HUD 画到 ctx 上（不要 clearRect，那是外层负责的）。
 */
export interface Theme {
  id: string
  name: string
  preview: ThemePreview
  /** 主题在画布上画 HUD 的所有元素（widget、装饰等） */
  drawHud(ctx: CanvasRenderingContext2D, frame: HudFrame): void
}

/** 颜色插值工具（绿→黄→红 等渐变常用） */
export function lerpColor(stops: { at: number; rgb: [number, number, number] }[], ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio))
  for (let i = 1; i < stops.length; i++) {
    if (r <= stops[i].at) {
      const a = stops[i - 1], b = stops[i]
      const t = (r - a.at) / (b.at - a.at)
      const rgb = a.rgb.map((c, j) => Math.round(c + (b.rgb[j] - c) * t))
      return `rgb(${rgb.join(',')})`
    }
  }
  const last = stops[stops.length - 1].rgb
  return `rgb(${last.join(',')})`
}

/** 在指定 box 内画带阴影的文字 */
export function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    font: string
    color: string
    align?: CanvasTextAlign
    baseline?: CanvasTextBaseline
    shadow?: { color: string; blur: number; offsetX?: number; offsetY?: number }
  },
) {
  ctx.save()
  ctx.font = opts.font
  ctx.fillStyle = opts.color
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = opts.baseline ?? 'alphabetic'
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow.color
    ctx.shadowBlur = opts.shadow.blur
    ctx.shadowOffsetX = opts.shadow.offsetX ?? 0
    ctx.shadowOffsetY = opts.shadow.offsetY ?? 0
  }
  ctx.fillText(text, x, y)
  ctx.restore()
}
