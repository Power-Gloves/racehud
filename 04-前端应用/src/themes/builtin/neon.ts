/**
 * 主题：霓虹（深度自绘）
 * 风格：赛博朋克霓虹管——深邃暗蓝底 + 青/品红双色霓虹发光
 *   - 速度表：霓虹管弧线（外发光粗管 + 亮芯细线），超大发光数字
 *   - G球：三层霓虹环 + 发光十字 + 品红发光 G 点
 *   - 圈速/地图/圈信息：通用 widget + 精调霓虹皮肤
 */
import type { Theme, HudFrame } from '../types'
import {
  drawLapInfo, drawLapList, drawMiniMap,
  pctBox, type WidgetSkin, type Box,
} from '../widgets'

// 霓虹双色
const CYAN = '#00eaff'
const MAGENTA = '#ff2bd6'

const NUM_FONT = '"Aldrich", "Open Sans", monospace'
const LABEL_FONT = '600 12px "Aldrich", sans-serif'

const SKIN: WidgetSkin = {
  bg: 'rgba(2,6,23,0.62)',
  border: 'rgba(0,234,255,0.55)',
  borderWidth: 1.5,
  radius: 4,
  padding: 12,
  textColor: '#e6fbff',
  textDimColor: '#5fdcf0',
  accentColor: CYAN,
  goodColor: '#39ff14',
  warnColor: MAGENTA,
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,234,255,0.75)',
}

/** 画霓虹管线条：先画一层粗的低透明外发光，再叠一层亮芯 */
function neonArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  a0: number, a1: number,
  color: string, coreW: number,
) {
  ctx.save()
  ctx.lineCap = 'round'
  // 外发光层
  ctx.strokeStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = coreW * 3
  ctx.globalAlpha = 0.55
  ctx.lineWidth = coreW * 1.8
  ctx.beginPath()
  ctx.arc(cx, cy, r, a0, a1)
  ctx.stroke()
  // 亮芯
  ctx.globalAlpha = 1
  ctx.shadowBlur = coreW
  ctx.lineWidth = coreW * 0.5
  ctx.strokeStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx, cy, r, a0, a1)
  ctx.stroke()
  ctx.restore()
}

/** 霓虹发光文字 */
function neonText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  font: string, color: string,
  align: CanvasTextAlign = 'center', baseline: CanvasTextBaseline = 'middle',
) {
  ctx.save()
  ctx.font = font
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  // 叠白芯提亮
  ctx.shadowBlur = 4
  ctx.fillStyle = '#ffffff'
  ctx.globalAlpha = 0.85
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** 霓虹速度表 */
function drawNeonSpeed(ctx: CanvasRenderingContext2D, box: Box, frame: HudFrame) {
  const speed = frame.current?.speed ?? 0
  let maxSpd = 0
  for (const s of frame.samples) if (s.speed > maxSpd) maxSpd = s.speed
  if (maxSpd < 1) maxSpd = 1
  const ratio = Math.max(0, Math.min(1, speed / maxSpd))

  const cx = box.x + box.w / 2
  const cy = box.y + box.h * 0.52
  const r = Math.min(box.w, box.h * 0.92) * 0.42
  const startAng = (140 * Math.PI) / 180
  const endAng = (320 * Math.PI) / 180
  const coreW = Math.max(4, r * 0.10)

  // 背景轨道（暗青低透明）
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(0,234,255,0.14)'
  ctx.lineWidth = coreW * 1.6
  ctx.beginPath()
  ctx.arc(cx, cy, r, startAng, endAng)
  ctx.stroke()
  ctx.restore()

  // 填充弧（霓虹管）：比例低偏青、高偏品红
  const fillAng = startAng + (endAng - startAng) * ratio
  const arcColor = ratio < 0.7 ? CYAN : MAGENTA
  neonArc(ctx, cx, cy, r, startAng, fillAng, arcColor, coreW)

  // 刻度霓虹小点（每 10%）
  ctx.save()
  for (let i = 0; i <= 10; i++) {
    const a = startAng + (endAng - startAng) * (i / 10)
    const px = cx + Math.cos(a) * (r + coreW * 1.4)
    const py = cy + Math.sin(a) * (r + coreW * 1.4)
    const on = i / 10 <= ratio
    ctx.beginPath()
    ctx.arc(px, py, 2, 0, Math.PI * 2)
    ctx.fillStyle = on ? CYAN : 'rgba(0,234,255,0.25)'
    if (on) { ctx.shadowColor = CYAN; ctx.shadowBlur = 8 }
    ctx.fill()
    ctx.shadowBlur = 0
  }
  ctx.restore()

  // SPEED 标签
  neonText(ctx, 'SPEED', cx, cy - r * 0.42, LABEL_FONT, CYAN)
  // 超大速度数字
  const numF = `700 ${Math.round(box.h * 0.34)}px ${NUM_FONT}`
  neonText(ctx, String(Math.round(speed)), cx, cy + r * 0.04, numF, '#ffffff')
  // 单位
  const unit = frame.unit === 'mph' ? 'MPH' : 'KM/H'
  neonText(ctx, unit, cx, cy + r * 0.44, LABEL_FONT, MAGENTA)
}

/** 霓虹 G 球 */
function drawNeonGBall(ctx: CanvasRenderingContext2D, box: Box, frame: HudFrame) {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h * 0.55
  const r = Math.min(box.w, box.h * 0.85) * 0.38

  let maxG = 0
  for (const s of frame.samples) {
    const g = Math.hypot(s.gLat ?? 0, s.gLong ?? 0)
    if (g > maxG) maxG = g
  }
  if (maxG < 0.5) maxG = 1.0
  const gLat = frame.current?.gLat ?? 0
  const gLong = frame.current?.gLong ?? 0
  const curG = Math.hypot(gLat, gLong)
  const ratio = Math.max(0, Math.min(1, curG / maxG))

  // 三层霓虹环（青色描边发光）
  ctx.save()
  for (const rr of [r, r * 0.66, r * 0.33]) {
    ctx.strokeStyle = CYAN
    ctx.shadowColor = CYAN
    ctx.shadowBlur = 10
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, rr, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  // 发光十字
  ctx.save()
  ctx.strokeStyle = CYAN
  ctx.shadowColor = CYAN
  ctx.shadowBlur = 6
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy)
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r)
  ctx.stroke()
  ctx.restore()

  // 外环 G 进度（品红霓虹）
  if (ratio > 0.001) {
    neonArc(ctx, cx, cy, r * 1.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, MAGENTA, 3)
  }

  // G 点（品红发光双层）
  const dx = Math.max(-1, Math.min(1, gLat / maxG)) * r
  const dy = Math.max(-1, Math.min(1, -gLong / maxG)) * r
  ctx.save()
  ctx.fillStyle = MAGENTA
  ctx.shadowColor = MAGENTA
  ctx.shadowBlur = 16
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.arc(cx + dx, cy + dy, Math.max(6, r * 0.18), 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.shadowBlur = 8
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx + dx, cy + dy, Math.max(3, r * 0.09), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // label + 数值
  neonText(ctx, 'G FORCE', cx, box.y + 12, LABEL_FONT, CYAN, 'center', 'top')
  neonText(ctx, `${curG.toFixed(2)}G`, cx, box.y + box.h - 12, `700 ${Math.round(box.h * 0.14)}px ${NUM_FONT}`, MAGENTA, 'center', 'bottom')
}

/** 地图专用皮肤：无背景盒子，霓虹青赛道线 */
const MAP_SKIN: WidgetSkin = {
  padding: 8,
  textColor: CYAN,
  textDimColor: '#5fdcf0',
  accentColor: MAGENTA,
  goodColor: '#39ff14',
  warnColor: MAGENTA,
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,234,255,0.75)',
}

export const neonTheme: Theme = {
  id: 'neon',
  name: '霓虹',
  preview: { bg: '#020617', border: CYAN, text: CYAN, accent: MAGENTA },
  drawHud(ctx, frame) {
    drawMiniMap(ctx, pctBox(frame, 'tl', 0.02, 0.02, 0.13, 0.20), frame, MAP_SKIN)
    drawLapInfo(ctx, pctBox(frame, 'tc', 0, 0.025, 0.20, 0.07), frame, SKIN)
    drawLapList(ctx, pctBox(frame, 'tr', 0.02, 0.02, 0.115, 0.24), frame, SKIN)
    drawNeonSpeed(ctx, pctBox(frame, 'bl', 0.02, 0.04, 0.16, 0.22), frame)
    drawNeonGBall(ctx, pctBox(frame, 'br', 0.02, 0.04, 0.13, 0.20), frame)
  },
}
