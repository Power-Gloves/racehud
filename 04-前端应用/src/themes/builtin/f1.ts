/**
 * 主题：F1 转播
 * 风格：F1 直播 GFX 风格——左下大速度看板（无圆角）、顶部居中圈号条、红色镶边
 *
 * 演示主题接口的灵活性：完全自定义布局，不一定用通用 widget。
 */
import type { Theme, HudFrame } from '../types'
import { lerpColor } from '../types'
import { pctBox, drawMiniMap, drawLapList, type WidgetSkin } from '../widgets'

const SKIN: WidgetSkin = {
  bg: 'rgba(20,20,30,0.92)',
  border: '#dc2626',
  borderWidth: 2,
  radius: 0,                  // 直角边，F1 风
  padding: 10,
  textColor: '#ffffff',
  textDimColor: '#9ca3af',
  accentColor: '#facc15',
  goodColor: '#22c55e',
  warnColor: '#dc2626',
  numFont: '"Aldrich", "Open Sans", monospace',
  labelFont: '700 12px "Aldrich", sans-serif',
  textShadow: 'rgba(0,0,0,0.7)',
}

export const f1Theme: Theme = {
  id: 'f1',
  name: 'F1 转播',
  preview: { bg: '#14141e', border: '#dc2626', text: '#ffffff', accent: '#facc15' },
  drawHud(ctx, frame) {
    // 左下：F1 风格速度大看板（自定义画法，不用 drawSpeedGauge）
    drawF1SpeedBoard(ctx, pctBox(frame, 'bl', 0.02, 0.04, 0.20, 0.16), frame, SKIN)
    // 顶部居中：当前圈 / 圈时
    drawF1LapBanner(ctx, pctBox(frame, 'tc', 0, 0.03, 0.30, 0.08), frame, SKIN)
    // 右上：圈榜（用通用组件）
    drawLapList(ctx, pctBox(frame, 'tr', 0.02, 0.02, 0.14, 0.30), frame, SKIN)
    // 左上：迷你地图
    drawMiniMap(ctx, pctBox(frame, 'tl', 0.02, 0.02, 0.13, 0.20), frame, SKIN)
  },
}

/** F1 风格速度看板：左半底色块 + 右半数字 */
function drawF1SpeedBoard(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, frame: HudFrame, skin: WidgetSkin) {
  const speed = frame.current?.speed ?? 0
  let maxSpd = 0
  for (const s of frame.samples) if (s.speed > maxSpd) maxSpd = s.speed
  const ratio = maxSpd > 0 ? speed / maxSpd : 0

  // 大背景
  ctx.save()
  ctx.fillStyle = skin.bg!
  ctx.fillRect(box.x, box.y, box.w, box.h)
  // 顶部红条
  ctx.fillStyle = skin.warnColor!
  ctx.fillRect(box.x, box.y, box.w, 4)
  ctx.restore()

  // 左侧：SPEED 标签
  ctx.save()
  ctx.font = skin.labelFont
  ctx.fillStyle = skin.textDimColor
  ctx.textBaseline = 'top'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  ctx.fillText('SPEED', box.x + 14, box.y + 12)
  ctx.restore()

  // 大数字（占主区）
  const numFontSize = Math.round(box.h * 0.50)
  ctx.save()
  ctx.font = `700 ${numFontSize}px ${skin.numFont}`
  ctx.fillStyle = skin.textColor
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 6 }
  ctx.fillText(String(Math.round(speed)), box.x + 14, box.y + box.h * 0.62)
  ctx.restore()

  // 单位
  ctx.save()
  ctx.font = skin.labelFont
  ctx.fillStyle = skin.textDimColor
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'right'
  ctx.fillText(frame.unit === 'mph' ? 'MPH' : 'KM/H', box.x + box.w - 14, box.y + box.h - 10)
  ctx.restore()

  // 右侧速度条（从底向上）
  const barW = box.w * 0.10
  const barX = box.x + box.w - barW - 10
  const barTop = box.y + 14
  const barBot = box.y + box.h - 14
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(barX, barTop, barW, barBot - barTop)
  const fillH = (barBot - barTop) * ratio
  const color = lerpColor([
    { at: 0, rgb: [34, 197, 94] }, { at: 0.5, rgb: [250, 204, 21] }, { at: 1, rgb: [220, 38, 38] },
  ], ratio)
  ctx.fillStyle = color
  ctx.fillRect(barX, barBot - fillH, barW, fillH)
  ctx.restore()
}

/** 顶部圈号条：横向 LAP n · 0:27.35 · vs BEST -1.81 */
function drawF1LapBanner(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, frame: HudFrame, skin: WidgetSkin) {
  const cur = frame.current
  const lapNum = cur?.lapNum ?? 0
  const lapTime = (cur?.lapTimeInLap ?? 0) / 1000
  const cmp = cur?.bestCompare ?? 0

  ctx.save()
  ctx.fillStyle = skin.bg!
  ctx.fillRect(box.x, box.y, box.w, box.h)
  ctx.fillStyle = skin.warnColor!
  ctx.fillRect(box.x, box.y, 6, box.h)  // 左红条
  ctx.restore()

  const fontSize = Math.round(box.h * 0.55)
  ctx.save()
  ctx.font = `700 ${fontSize}px ${skin.numFont}`
  ctx.textBaseline = 'middle'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 5 }
  const cy = box.y + box.h / 2
  // LAP n
  ctx.fillStyle = skin.textDimColor
  ctx.font = `${Math.round(box.h * 0.30)}px ${skin.labelFont}`
  ctx.fillText('LAP', box.x + 18, cy)
  ctx.fillStyle = skin.textColor
  ctx.font = `700 ${fontSize}px ${skin.numFont}`
  ctx.fillText(String(lapNum), box.x + 60, cy)
  // 当前圈时
  ctx.fillText(formatLap(lapTime), box.x + box.w * 0.40, cy)
  // vs BEST
  if (cmp !== 0) {
    ctx.fillStyle = cmp < 0 ? skin.goodColor! : skin.warnColor!
    const sign = cmp > 0 ? '+' : '−'
    ctx.fillText(`${sign}${Math.abs(cmp).toFixed(2)}`, box.x + box.w * 0.72, cy)
  }
  ctx.restore()
}

function formatLap(s: number): string {
  if (!s || s <= 0) return '--'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`
}
