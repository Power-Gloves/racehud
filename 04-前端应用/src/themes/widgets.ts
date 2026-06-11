/**
 * 通用 widget canvas 绘制工具
 *
 * 主题可以自由组合调用这些（也可以不用，自己画也行）。
 * 设计理念：每个函数接收 box 区域 + 数据 + 配色，画到 ctx。
 */
import type { HudFrame } from './types'
import { lerpColor } from './types'

/** 通用配置：一个 widget 的"皮肤" */
export interface WidgetSkin {
  bg?: string                // 卡片背景（可空 = 不画背景，纯叠加）
  border?: string
  borderWidth?: number
  radius?: number
  /** 可选的柔光：透明 widget 不画卡片但加一层径向暗色光晕保证可读 */
  glow?: { color: string; opacity: number }
  padding?: number
  textColor: string
  textDimColor: string
  accentColor: string
  goodColor?: string
  warnColor?: string
  numFont: string            // 数字字体（如 '"JetBrains Mono", monospace'）
  labelFont: string          // 小标签字体
  textShadow?: string        // 'rgba(0,0,0,0.85)' 等
}

export interface Box { x: number; y: number; w: number; h: number }

/** 画卡片背景（可选） */
export function drawCard(ctx: CanvasRenderingContext2D, box: Box, skin: WidgetSkin) {
  // 优先 glow 模式：径向暗色渐变，让透明 widget 在亮背景上仍可读
  if (skin.glow) {
    ctx.save()
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    const r = Math.max(box.w, box.h) * 0.7
    const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
    grad.addColorStop(0, hexWithAlpha(skin.glow.color, skin.glow.opacity))
    grad.addColorStop(1, hexWithAlpha(skin.glow.color, 0))
    ctx.fillStyle = grad
    ctx.fillRect(box.x - r * 0.3, box.y - r * 0.3, box.w + r * 0.6, box.h + r * 0.6)
    ctx.restore()
  }
  if (!skin.bg && !skin.border) return
  ctx.save()
  const r = skin.radius ?? 6
  roundRect(ctx, box.x, box.y, box.w, box.h, r)
  if (skin.bg) {
    ctx.fillStyle = skin.bg
    ctx.fill()
  }
  if (skin.border) {
    ctx.lineWidth = skin.borderWidth ?? 1
    ctx.strokeStyle = skin.border
    ctx.stroke()
  }
  ctx.restore()
}

function hexWithAlpha(color: string, alpha: number): string {
  // 接受 'rgb(r,g,b)' / '#rgb' / '#rrggbb'，返回 'rgba(r,g,b,alpha)'
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`)
  if (color.startsWith('rgba')) return color // 已含 alpha
  // 解析 hex
  let hex = color.replace('#', '')
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 速度仪表盘（半圆 + 渐变颜色） */
export function drawSpeedGauge(
  ctx: CanvasRenderingContext2D,
  box: Box,
  frame: HudFrame,
  skin: WidgetSkin,
) {
  const speed = frame.current?.speed ?? 0
  // 用整段最大速度做满刻度
  let maxSpd = 0
  for (const s of frame.samples) if (s.speed > maxSpd) maxSpd = s.speed
  if (maxSpd < 1) maxSpd = 1
  const ratio = Math.max(0, Math.min(1, speed / maxSpd))

  drawCard(ctx, box, skin)

  const cx = box.x + box.w / 2
  const cy = box.y + box.h * 0.52
  const r = Math.min(box.w, box.h * 0.92) * 0.42
  // 弧从 8 点钟(140°)到 2 点钟(320°)，开口朝底部，更现代的仪表感
  const startAng = (140 * Math.PI) / 180
  const endAng = (320 * Math.PI) / 180
  const fillAng = startAng + (endAng - startAng) * ratio
  const lineW = Math.max(5, r * 0.13)

  ctx.save()
  ctx.lineCap = 'round'
  // 背景轨道
  ctx.beginPath()
  ctx.arc(cx, cy, r, startAng, endAng)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = lineW
  ctx.stroke()
  // 填充弧：沿弧线方向的渐变（绿→黄→红，速度高低的通用表达）
  const sx = cx + Math.cos(startAng) * r
  const sy = cy + Math.sin(startAng) * r
  const ex = cx + Math.cos(endAng) * r
  const ey = cy + Math.sin(endAng) * r
  const grad = ctx.createLinearGradient(sx, sy, ex, ey)
  grad.addColorStop(0, '#34d399')
  grad.addColorStop(0.5, '#fbbf24')
  grad.addColorStop(1, '#ef4444')
  ctx.beginPath()
  ctx.arc(cx, cy, r, startAng, fillAng)
  ctx.strokeStyle = grad
  ctx.lineWidth = lineW
  if (skin.textShadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6 }
  ctx.stroke()
  ctx.restore()

  // SPEED 标签（弧中心上方）
  ctx.save()
  ctx.font = skin.labelFont
  ctx.fillStyle = skin.textDimColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  ctx.fillText('SPEED', cx, cy - r * 0.42)
  ctx.restore()

  // 数字（弧中心，每字符固定槽宽，彻底不抖）
  ctx.save()
  const numFontSize = Math.round(box.h * 0.30)
  ctx.font = `700 ${numFontSize}px ${skin.numFont}`
  ctx.fillStyle = skin.textColor
  ctx.textBaseline = 'middle'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 6 }
  const charW = numFontSize * 0.62
  drawFixedWidthText(ctx, String(Math.round(speed)), cx, cy + r * 0.05, charW, 'center')
  ctx.restore()

  // 单位（数字下方）
  ctx.save()
  ctx.font = skin.labelFont
  ctx.fillStyle = skin.textDimColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  const unitText = (frame.unit === 'mph' ? 'MPH' : 'KM/H')
  ctx.fillText(unitText, cx, cy + r * 0.42)
  ctx.restore()

  // 0 / max 刻度（弧两端外侧）
  ctx.save()
  ctx.font = skin.labelFont
  ctx.fillStyle = skin.textDimColor
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  const z0x = cx + Math.cos(startAng) * (r + lineW)
  const z0y = cy + Math.sin(startAng) * (r + lineW)
  ctx.fillText('0', z0x, z0y)
  const zmx = cx + Math.cos(endAng) * (r + lineW)
  const zmy = cy + Math.sin(endAng) * (r + lineW)
  ctx.fillText(String(Math.round(maxSpd)), zmx, zmy)
  ctx.restore()
}

/** 圈号 + 当前圈时 + 与最佳差 + 实时秒差进度条 */
export function drawLapInfo(
  ctx: CanvasRenderingContext2D,
  box: Box,
  frame: HudFrame,
  skin: WidgetSkin,
) {
  const cur = frame.current
  const lapNum = cur?.lapNum ?? 0
  const lapTimeMs = cur?.lapTimeInLap ?? 0
  const bestCompare = cur?.bestCompare ?? 0

  drawCard(ctx, box, skin)
  const pad = skin.padding ?? 10

  // 给底部预留进度条空间
  const barH = 4
  const barGap = 8
  const contentH = box.h - barH - barGap

  const fields: { label: string; value: string; color: string }[] = [
    { label: 'LAP', value: String(lapNum), color: skin.textColor },
    { label: 'CUR', value: formatLap(lapTimeMs / 1000), color: skin.textColor },
    {
      label: 'vs BEST',
      value: formatDelta(bestCompare),
      color: bestCompare < 0 ? (skin.goodColor ?? skin.textColor)
        : bestCompare > 0 ? (skin.warnColor ?? skin.textColor)
        : skin.textColor,
    },
  ]

  const colW = (box.w - pad * 2) / fields.length
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const cx = box.x + pad + colW * i + colW / 2
    // label
    ctx.save()
    ctx.font = skin.labelFont
    ctx.fillStyle = skin.textDimColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
    ctx.fillText(f.label, cx, box.y + pad)
    ctx.restore()

    // value：字号同时受高度和列宽约束，长文本自动缩小防溢出/重叠
    ctx.save()
    let valueFont = Math.round(contentH * 0.46)
    const charRatio = 0.62
    // 限制文本总宽不超过列宽的 84%
    const maxTextW = colW * 0.84
    const textW = f.value.length * valueFont * charRatio
    if (textW > maxTextW) {
      valueFont = Math.floor(maxTextW / (f.value.length * charRatio))
    }
    ctx.font = `700 ${valueFont}px ${skin.numFont}`
    ctx.fillStyle = f.color
    ctx.textBaseline = 'middle'
    if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 6 }
    drawFixedWidthText(ctx, f.value, cx, box.y + contentH * 0.66, valueFont * charRatio, 'center')
    ctx.restore()
  }

  // 底部实时秒差进度条
  drawDeltaBar(ctx, box, contentH + barGap, barH, bestCompare, skin)
}

/** 实时秒差进度条：中线为 0，向左快/绿，向右慢/红 */
function drawDeltaBar(
  ctx: CanvasRenderingContext2D,
  box: Box,
  yOffset: number,
  h: number,
  delta: number,
  skin: WidgetSkin,
) {
  const pad = skin.padding ?? 10
  const barX = box.x + pad
  const barW = box.w - pad * 2
  const barY = box.y + yOffset
  const cxBar = barX + barW / 2

  // 背景轨道
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, barX, barY, barW, h, h / 2)
  ctx.fill()
  ctx.restore()

  // 中线刻度
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.40)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cxBar, barY - 2)
  ctx.lineTo(cxBar, barY + h + 2)
  ctx.stroke()
  ctx.restore()

  if (!Number.isFinite(delta) || delta === 0) return

  // |delta| 映射到 bar 宽度的一半（满格为 1.5 秒）
  const FULL_SCALE = 1.5
  const ratio = Math.max(-1, Math.min(1, delta / FULL_SCALE))
  const fillW = (barW / 2) * Math.abs(ratio)

  ctx.save()
  if (delta < 0) {
    // 快：从中间往左延伸，绿色
    ctx.fillStyle = skin.goodColor ?? '#10b981'
    if (skin.textShadow) { ctx.shadowColor = skin.goodColor ?? '#10b981'; ctx.shadowBlur = 6 }
    roundRect(ctx, cxBar - fillW, barY, fillW, h, h / 2)
    ctx.fill()
  } else {
    // 慢：从中间往右延伸，红色
    ctx.fillStyle = skin.warnColor ?? '#f43f5e'
    if (skin.textShadow) { ctx.shadowColor = skin.warnColor ?? '#f43f5e'; ctx.shadowBlur = 6 }
    roundRect(ctx, cxBar, barY, fillW, h, h / 2)
    ctx.fill()
  }
  ctx.restore()
}

/** 圈榜（list）
 * 布局：[BEST 行（最快圈，置顶锚定）] + [最近 maxRecentLines 圈（含当前圈）]
 * 盒子高度建议刚好容纳 1 + maxRecentLines 行，避免下方留白。
 */
export function drawLapList(
  ctx: CanvasRenderingContext2D,
  box: Box,
  frame: HudFrame,
  skin: WidgetSkin,
  opts: { maxRecentLines?: number; maxLines?: number } = {},
) {
  drawCard(ctx, box, skin)
  const pad = skin.padding ?? 10
  // 兼容旧 maxLines 字段；默认显示 BEST + 4 行
  const maxRecent = opts.maxRecentLines ?? (opts.maxLines ?? 4)

  // 标签
  const labelFontSize = 14
  ctx.save()
  ctx.font = `700 ${labelFontSize}px "Rajdhani", "Open Sans", sans-serif`
  ctx.fillStyle = skin.textDimColor
  ctx.textBaseline = 'top'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 3 }
  ctx.fillText('LAPS', box.x + pad, box.y + pad)
  ctx.restore()

  const valid = frame.laps.filter(l => l.lapNum > 0)
  if (valid.length === 0) return

  // 锚定最快圈
  const bestLap = frame.bestLap

  // 取最近 maxRecent 圈（围绕当前圈）
  const curIdx = valid.findIndex(l => l.isCurrent)
  const end = curIdx >= 0 ? curIdx + 1 : valid.length
  const start = Math.max(0, end - maxRecent)
  const recent = valid.slice(start, end)

  // 行高/字号根据 widget 尺寸动态算（让盒子刚好填满且不重叠）
  const totalRows = (bestLap ? 1 : 0) + recent.length
  const availH = box.h - pad * 2 - labelFontSize - 10
  const evenH = totalRows > 0 ? availH / totalRows : 35
  const lineH = Math.min(evenH, 35)
  // 字号自适应：受行高(×0.6)与盒宽(×0.15)双重约束，上限22下限9，防重叠
  const fontSize = Math.max(9, Math.min(22, Math.floor(lineH * 0.6), Math.floor(box.w * 0.15)))
  const startY = box.y + pad + labelFontSize + 8

  // 三列布局：圈号占左 22%，圈时占中 50%，delta 占右 28%
  const colNumX = box.x + pad + 8  // 留点空间给左侧色块条
  const colTimeX = box.x + pad + box.w * 0.28
  const colDeltaX = box.x + box.w - pad

  let row = 0

  // 先画 BEST 行（置顶）
  if (bestLap) {
    const y = startY + row * lineH
    drawLapRow(ctx, bestLap, true, false, y, fontSize, colNumX, colTimeX, colDeltaX, skin, null)
    // BEST 下面画一条细分隔线，跟"最近"区分
    ctx.save()
    ctx.strokeStyle = skin.textDimColor
    ctx.globalAlpha = 0.30
    ctx.lineWidth = 1
    ctx.beginPath()
    const sepY = y + lineH - 3
    ctx.moveTo(box.x + pad, sepY)
    ctx.lineTo(box.x + box.w - pad, sepY)
    ctx.stroke()
    ctx.restore()
    row++
  }

  // 最近几圈
  for (const l of recent) {
    if (bestLap && l.lapNum === bestLap.lapNum) continue // 已经在置顶画过了，跳过
    const y = startY + row * lineH
    if (y + lineH > box.y + box.h - pad) break
    drawLapRow(ctx, l, false, l.isCurrent, y, fontSize, colNumX, colTimeX, colDeltaX, skin, bestLap)
    row++
  }
}

function drawLapRow(
  ctx: CanvasRenderingContext2D,
  l: { lapNum: number; lapTime: number },
  isBest: boolean,
  isCurrent: boolean,
  y: number,
  fontSize: number,
  colNumX: number,
  colTimeX: number,
  colDeltaX: number,
  skin: WidgetSkin,
  bestLap: { lapTime: number; lapNum: number } | null,
) {
  // 左侧色块条：BEST 绿、当前圈青、其它无
  const stripColor = isBest ? (skin.goodColor ?? '#10b981')
    : isCurrent ? skin.accentColor
    : null
  if (stripColor) {
    ctx.save()
    ctx.fillStyle = stripColor
    if (skin.textShadow) { ctx.shadowColor = stripColor; ctx.shadowBlur = 6 }
    // 圆角竖条紧贴最左
    const stripW = Math.max(3, fontSize * 0.18)
    const stripH = fontSize + 4
    roundRect(ctx, colNumX - stripW - 6, y - 1, stripW, stripH, stripW / 2)
    ctx.fill()
    ctx.restore()
  }

  // 文字基础色：所有行都用主文字色（白），靠左侧色块区分状态——更清爽
  const textColor = skin.textColor

  ctx.save()
  ctx.font = `${fontSize}px ${skin.numFont}`
  ctx.fillStyle = textColor
  ctx.textBaseline = 'top'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 3 }

  const cw = fontSize * 0.55

  // 圈号
  drawFixedWidthText(ctx, `L${l.lapNum}`, colNumX, y, cw, 'left')
  // 圈时
  drawFixedWidthText(ctx, formatLap(l.lapTime), colTimeX, y, cw, 'left')
  ctx.restore()

  // 右列
  if (isBest) {
    // BEST 标签：用方形小徽章，绿底白字
    const tagText = 'BEST'
    const tagFont = Math.round(fontSize * 0.55)
    ctx.save()
    ctx.font = `700 ${tagFont}px "Rajdhani", "Open Sans", sans-serif`
    const tw = ctx.measureText(tagText).width
    const padX = 6
    const tagH = tagFont + 4
    const tagX = colDeltaX - tw - padX * 2
    const tagY = y + (fontSize - tagH) / 2 + 1
    ctx.fillStyle = skin.goodColor ?? '#10b981'
    if (skin.textShadow) { ctx.shadowColor = skin.goodColor ?? '#10b981'; ctx.shadowBlur = 6 }
    roundRect(ctx, tagX, tagY, tw + padX * 2, tagH, 3)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(tagText, tagX + padX, tagY + 2)
    ctx.restore()
  } else if (bestLap && l.lapNum !== bestLap.lapNum) {
    const d = l.lapTime - bestLap.lapTime
    ctx.save()
    ctx.font = `${fontSize - 2}px ${skin.numFont}`
    ctx.fillStyle = d > 0 ? (skin.warnColor ?? '#f43f5e') : (skin.goodColor ?? '#10b981')
    ctx.textBaseline = 'top'
    if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 3 }
    const sign = d > 0 ? '+' : '−'
    drawFixedWidthText(ctx, `${sign}${Math.abs(d).toFixed(2)}`, colDeltaX, y + 1, (fontSize - 2) * 0.55, 'right')
    ctx.restore()
  }
}

/** G 球：圆心代表静止，点位置代表当前 G 向量；外圈"环形进度"表示当前合 G 占数据集最大 G 的比例 */
export function drawGForceBall(
  ctx: CanvasRenderingContext2D,
  box: Box,
  frame: HudFrame,
  skin: WidgetSkin,
) {
  drawCard(ctx, box, skin)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h * 0.55
  const r = Math.min(box.w, box.h * 0.85) * 0.36

  // 整段最大合 G（自适应满量程）
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

  // 1. 三层同心圆背景（黑色半透明，透明度递减，立体感）
  const rings = [
    { rr: r, alpha: 0.42 },
    { rr: r * 0.72, alpha: 0.34 },
    { rr: r * 0.44, alpha: 0.26 },
  ]
  for (const ring of rings) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, ring.rr, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0,0,0,${ring.alpha})`
    ctx.fill()
    ctx.restore()
  }

  // 2. 外环背景轨道
  ctx.save()
  ctx.strokeStyle = skin.textColor
  ctx.globalAlpha = 0.18
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.18, -Math.PI / 2, Math.PI * 1.5)
  ctx.stroke()
  ctx.restore()

  // 3. 外环填充（按当前 G / maxG）
  if (ratio > 0.001) {
    ctx.save()
    ctx.strokeStyle = skin.accentColor
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    if (skin.textShadow) { ctx.shadowColor = skin.accentColor; ctx.shadowBlur = 6 }
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
    ctx.stroke()
    ctx.restore()
  }

  // 4. 十字准线（白色半透明）
  ctx.save()
  ctx.strokeStyle = skin.textColor
  ctx.globalAlpha = 0.28
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy)
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r)
  ctx.stroke()
  ctx.restore()

  // 5. 当前 G 点位置（双层圆点）
  const dx = Math.max(-1, Math.min(1, gLat / maxG)) * r
  const dy = Math.max(-1, Math.min(1, -gLong / maxG)) * r
  ctx.save()
  ctx.fillStyle = skin.accentColor
  ctx.globalAlpha = 0.3
  if (skin.textShadow) { ctx.shadowColor = skin.accentColor; ctx.shadowBlur = 10 }
  ctx.beginPath()
  ctx.arc(cx + dx, cy + dy, Math.max(6, r * 0.18), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.fillStyle = skin.accentColor
  if (skin.textShadow) { ctx.shadowColor = skin.accentColor; ctx.shadowBlur = 8 }
  ctx.beginPath()
  ctx.arc(cx + dx, cy + dy, Math.max(3, r * 0.10), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 6. 顶部 label + 底部当前 G 数值
  ctx.save()
  ctx.font = skin.labelFont
  ctx.fillStyle = skin.textDimColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 3 }
  ctx.fillText('G FORCE', cx, box.y + (skin.padding ?? 10))
  ctx.restore()

  ctx.save()
  const numFontSize = Math.round(box.h * 0.14)
  ctx.font = `700 ${numFontSize}px ${skin.numFont}`
  ctx.fillStyle = skin.textColor
  ctx.textBaseline = 'bottom'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  drawFixedWidthText(ctx, `${curG.toFixed(2)}G`, cx, box.y + box.h - (skin.padding ?? 10), numFontSize * 0.55, 'center')
  ctx.restore()
}

/** 迷你赛道图 */
export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  box: Box,
  frame: HudFrame,
  skin: WidgetSkin,
) {
  drawCard(ctx, box, skin)
  const pad = skin.padding ?? 8

  // 选单圈底图：找点数最接近中位数的圈
  const counts = new Map<number, number>()
  for (const s of frame.samples) {
    if (s.lapNum != null && s.lapNum > 0) counts.set(s.lapNum, (counts.get(s.lapNum) ?? 0) + 1)
  }
  let trackSamples = frame.samples
  if (counts.size > 0) {
    const sorted = [...counts.values()].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    let bestLapNum: number | undefined
    let bestDiff = Infinity
    for (const [num, c] of counts) {
      const diff = Math.abs(c - median)
      if (diff < bestDiff) { bestDiff = diff; bestLapNum = num }
    }
    const filtered = frame.samples.filter(s => s.lapNum === bestLapNum)
    if (filtered.length > 10) trackSamples = filtered
  }
  if (trackSamples.length < 2) return

  // 经纬度范围 + cosLat 校正
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const s of trackSamples) {
    if (s.lat < minLat) minLat = s.lat
    if (s.lat > maxLat) maxLat = s.lat
    if (s.lng < minLng) minLng = s.lng
    if (s.lng > maxLng) maxLng = s.lng
  }
  const midLat = (minLat + maxLat) / 2
  const cosLat = Math.cos(midLat * Math.PI / 180)
  const wMeters = (maxLng - minLng) * cosLat || 1e-9
  const hMeters = (maxLat - minLat) || 1e-9
  const innerW = box.w - pad * 2 - 14 // 给 label 留空
  const innerH = box.h - pad * 2 - 14
  const scale = Math.min(innerW / wMeters, innerH / hMeters)
  const drawW = wMeters * scale
  const drawH = hMeters * scale
  const offX = box.x + pad + 7 + (innerW - drawW) / 2
  const offY = box.y + pad + 14 + (innerH - drawH) / 2

  const proj = (lat: number, lng: number): [number, number] => [
    offX + (lng - minLng) * cosLat * scale,
    offY + (maxLat - lat) * scale, // 纬度高 → y 小
  ]

  // 路径
  const step = Math.max(1, Math.floor(trackSamples.length / 200))
  ctx.save()
  ctx.strokeStyle = skin.textColor   // 用主文字色，更显眼
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 6 }
  ctx.beginPath()
  for (let i = 0; i < trackSamples.length; i += step) {
    const [x, y] = proj(trackSamples[i].lat, trackSamples[i].lng)
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.restore()

  // 终点线
  if (frame.finishLine) {
    const [ax, ay] = proj(frame.finishLine.a.lat, frame.finishLine.a.lng)
    const [bx, by] = proj(frame.finishLine.b.lat, frame.finishLine.b.lng)
    ctx.save()
    ctx.strokeStyle = skin.warnColor ?? '#f87171'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.restore()
  }

  // 当前位置点
  if (frame.current) {
    const [cx, cy] = proj(frame.current.lat, frame.current.lng)
    ctx.save()
    ctx.fillStyle = skin.accentColor
    if (skin.textShadow) { ctx.shadowColor = skin.accentColor; ctx.shadowBlur = 6 }
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // label
  ctx.save()
  ctx.font = skin.labelFont
  ctx.fillStyle = skin.textDimColor
  ctx.textBaseline = 'top'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  ctx.fillText('TRACK', box.x + pad + 4, box.y + pad)
  ctx.restore()
}

/* ============== 工具 ============== */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * 固定列宽画文字：每个字符占一个等宽的槽，彻底防抖动。
 * 不依赖字体是否真等宽，任何字体都能强制等宽显示。
 *
 * @param x 文字总区域左端
 * @param y 基线/顶部 y（按 ctx.textBaseline）
 * @param charWidth 每字符占多少像素
 */
export function drawFixedWidthText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  charWidth: number,
  align: 'left' | 'right' | 'center' = 'left',
) {
  const totalW = text.length * charWidth
  let startX = x
  if (align === 'right') startX = x - totalW
  else if (align === 'center') startX = x - totalW / 2

  const savedAlign = ctx.textAlign
  ctx.textAlign = 'center'
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], startX + charWidth * i + charWidth / 2, y)
  }
  ctx.textAlign = savedAlign
}

function formatLap(s: number): string {
  if (!s || s <= 0) return '--'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`
}

function formatDelta(s: number): string {
  if (!s) return '--'
  const sign = s > 0 ? '+' : '−'
  return `${sign}${Math.abs(s).toFixed(2)}`
}

/** 帮主题快速给 box 计算百分比位置（避免主题里全写百分比换算） */
export function pctBox(frame: HudFrame, anchor: 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc',
  px: number, py: number, w: number, h: number): Box {
  const W = frame.width, H = frame.height
  const ww = w * W, hh = h * H
  const ox = px * W, oy = py * H
  let x = 0, y = 0
  switch (anchor) {
    case 'tl': x = ox; y = oy; break
    case 'tr': x = W - ww - ox; y = oy; break
    case 'bl': x = ox; y = H - hh - oy; break
    case 'br': x = W - ww - ox; y = H - hh - oy; break
    case 'tc': x = (W - ww) / 2; y = oy; break
    case 'bc': x = (W - ww) / 2; y = H - hh - oy; break
  }
  return { x, y, w: ww, h: hh }
}
