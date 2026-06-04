/**
 * 主题：自定义（基于赛车游戏HUD设计）
 *
 * 字体：Orbitron（赛车/航天感数字字体）+ Rajdhani（窄体科技标签）
 * 风格：
 *   - 左下：圆形速度表，黄绿渐变弧线，显示最高/最低速度
 *   - 右上：深色半透明面板，显示多圈圈速和进度条
 *   - 右下：白色赛道轮廓 + 青色位置点
 *   - G球：透明叠加
 */
import type { Theme, HudFrame } from '../types'
import {
  pctBox, type WidgetSkin, drawCard, type Box,
} from '../widgets'

/** 绘制圆角矩形 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

// 数字用 Aldrich（等宽科技字体，每位数字宽度一致，不跳动）
// 标签用 Rajdhani（窄体科技感）
const NUM_FONT = '"Aldrich", "Open Sans", sans-serif'
const LABEL_FONT = '600 12px "Rajdhani", "Open Sans", sans-serif'

/** 透明 skin：用于速度表和G球 */
const TRANSPARENT_SKIN: WidgetSkin = {
  glow: { color: '#000000', opacity: 0.25 },
  padding: 8,
  textColor: '#ffffff',
  textDimColor: '#e0e0e0',
  accentColor: '#00e5ff', // 青色
  goodColor: '#4ade80', // 绿色（速度表弧线）
  warnColor: '#fb923c', // 橙色（速度表弧线起始）
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,0,0,0.95)',
}

/** 深色卡片 skin：用于右上角圈速面板 */
const DARK_CARD_SKIN: WidgetSkin = {
  bg: 'rgba(0,0,0,0.50)', // 纯黑色,50%透明度(更不透明)
  border: 'rgba(255,255,255,0.05)',
  borderWidth: 1,
  radius: 28, // 更大的圆角,从20改为28
  padding: 20,
  textColor: '#ffffff',
  textDimColor: '#94a3b8',
  accentColor: '#00e5ff', // 青色
  goodColor: '#4ade80', // 绿色
  warnColor: '#fb923c', // 橙色
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,0,0,0.85)',
}

/** 赛道地图 skin：白色线条 + 青色位置点 */
const MAP_SKIN: WidgetSkin = {
  // 去掉glow阴影
  padding: 8,
  textColor: '#ffffff',
  textDimColor: '#e0e0e0',
  accentColor: '#00e5ff', // 青色位置点
  goodColor: '#ffffff', // 白色赛道线
  warnColor: '#fb923c',
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,0,0,0.95)',
}

/** 自定义赛道地图绘制（无背景、无TRACK字样） */
function drawCustomMiniMap(
  ctx: CanvasRenderingContext2D,
  box: Box,
  frame: HudFrame,
  skin: WidgetSkin,
) {
  // 不绘制背景卡片
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
  const innerW = box.w - pad * 2
  const innerH = box.h - pad * 2
  const scale = Math.min(innerW / wMeters, innerH / hMeters)
  const drawW = wMeters * scale
  const drawH = hMeters * scale
  const offX = box.x + pad + (innerW - drawW) / 2
  const offY = box.y + pad + (innerH - drawH) / 2

  const proj = (lat: number, lng: number): [number, number] => [
    offX + (lng - minLng) * cosLat * scale,
    offY + (maxLat - lat) * scale,
  ]

  // 路径（白色）
  const step = Math.max(1, Math.floor(trackSamples.length / 200))
  ctx.save()
  ctx.strokeStyle = skin.goodColor || '#ffffff'
  ctx.lineWidth = 6  // 从4改为6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'  // 添加圆角端点
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 6 }
  ctx.beginPath()
  for (let i = 0; i < trackSamples.length; i += step) {
    const [x, y] = proj(trackSamples[i].lat, trackSamples[i].lng)
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.restore()

  // 绘制终点线（方格旗样式 - 棋盘格）
  if (frame.finishLine) {
    const [ax, ay] = proj(frame.finishLine.a.lat, frame.finishLine.a.lng)
    const [bx, by] = proj(frame.finishLine.b.lat, frame.finishLine.b.lng)
    
    // 计算线段长度和垂直方向
    const dx = bx - ax
    const dy = by - ay
    const len = Math.sqrt(dx * dx + dy * dy)
    const nx = -dy / len  // 垂直方向X
    const ny = dx / len   // 垂直方向Y
    
    ctx.save()
    
    // 方格旗参数
    const checkSize = 6      // 每个方格的边长
    const flagWidth = 12     // 旗帜宽度(垂直于线段方向)
    const numChecksAlong = Math.ceil(len / checkSize)
    const numChecksAcross = Math.ceil(flagWidth / checkSize)
    
    // 绘制棋盘格
    for (let row = 0; row < numChecksAcross; row++) {
      for (let col = 0; col < numChecksAlong; col++) {
        // 棋盘格黑白交替
        const isBlack = (row + col) % 2 === 0
        ctx.fillStyle = isBlack ? '#000000' : '#ffffff'
        
        // 计算方格的四个顶点
        const t0 = (col * checkSize) / len
        const t1 = Math.min(((col + 1) * checkSize) / len, 1)
        const w0 = (row - numChecksAcross / 2) * checkSize
        const w1 = (row + 1 - numChecksAcross / 2) * checkSize
        
        const x0 = ax + dx * t0 + nx * w0
        const y0 = ay + dy * t0 + ny * w0
        const x1 = ax + dx * t1 + nx * w0
        const y1 = ay + dy * t1 + ny * w0
        const x2 = ax + dx * t1 + nx * w1
        const y2 = ay + dy * t1 + ny * w1
        const x3 = ax + dx * t0 + nx * w1
        const y3 = ay + dy * t0 + ny * w1
        
        // 填充方格
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x3, y3)
        ctx.closePath()
        ctx.fill()
      }
    }
    
    ctx.restore()
  }

  // 绘制刹车点标记（红色圆点） - 暂时禁用，后续优化
  // ctx.save()
  // for (const bp of brakePoints) {
  //   const [bx, by] = proj(bp.lat, bp.lng)
  //   ctx.beginPath()
  //   ctx.arc(bx, by, 8, 0, 2 * Math.PI)
  //   ctx.fillStyle = 'rgba(244, 67, 54, 0.5)'
  //   ctx.fill()
  //   ctx.beginPath()
  //   ctx.arc(bx, by, 4, 0, 2 * Math.PI)
  //   ctx.fillStyle = '#f44336'
  //   ctx.shadowColor = '#f44336'
  //   ctx.shadowBlur = 6
  //   ctx.fill()
  // }
  // ctx.restore()

  // 当前位置点（青色）- 最后绘制，确保在最上层
  if (frame.current) {
    const [cx, cy] = proj(frame.current.lat, frame.current.lng)
    ctx.save()
    ctx.fillStyle = skin.accentColor || '#00e5ff'
    if (skin.textShadow) { ctx.shadowColor = skin.accentColor; ctx.shadowBlur = 8 }
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  
  // 不绘制 TRACK 标签
}

// 存储上一次的圈号,用于检测圈数变化触发动画
let lastLapNum = 0
let scrollAnimStartTime = 0
const SCROLL_DURATION = 500 // 滚动动画持续500ms

// G力极值追踪（用于渐消失尾迹效果）
interface GTrail {
  x: number
  y: number
  timestamp: number
  type: 'left' | 'right' | 'accel' | 'brake'
  gValue: number
}

const gTrails: GTrail[] = [] // 存储所有极值痕迹
const TRAIL_FADE_DURATION = 2000 // 痕迹2秒后完全消失
const MAX_TRAILS_PER_TYPE = 5 // 每个方向最多保留5个痕迹

// 每个方向的当前圈极值
let currentLapMaxLeft = 0
let currentLapMaxRight = 0
let currentLapMaxAccel = 0
let currentLapMaxBrake = 0
// let lastGLat = 0  // 未使用，注释掉
// let lastGLong = 0  // 未使用，注释掉
let lastRecordedLapNum = 0

// 弯道速度记录
interface CornerSpeed {
  maxSpeed: number  // 入弯前最高速度
  minSpeed: number  // 弯中最低速度
  timestamp: number // 出弯时间戳
  isActive: boolean // 是否还在弯道中
  brakePoint?: { lat: number, lng: number } // 刹车点位置
}

let currentCorner: CornerSpeed | null = null
let lastCornerDisplay: CornerSpeed | null = null
const CORNER_DISPLAY_DURATION = 3000 // 出弯后显示3秒
const CORNER_G_THRESHOLD = 0.8 // 横向G力阈值
const SPEED_DROP_RATE_THRESHOLD = -8 // 速度下降率阈值 (km/h/s)，负值表示减速
const CORNER_MIN_DURATION = 1000 // 弯道最短持续时间1秒
const CORNER_SPEED_DROP = 15 // 总速度下降阈值（km/h）
let inBrakingPhase = false // 是否在刹车阶段
let inCornerState = false
let cornerStartTime = 0
let brakingStartSpeed = 0
let lastSpeed = 0
let lastSpeedTime = 0
let recentSpeedHistory: Array<{speed: number, time: number}> = [] // 速度历史
const SPEED_HISTORY_DURATION = 5000

// 存储当前圈的所有刹车点
let brakePoints: Array<{ lat: number, lng: number, timestamp: number }> = []

/** 自定义圈速列表绘制（完全按照设计图） */
function drawCustomLapList(
  ctx: CanvasRenderingContext2D,
  box: Box,
  frame: HudFrame,
  skin: WidgetSkin,
) {
  // 调整位置：从右上角齐平位置，向下62.5px，向左62.5px
  // 原始box是基于pctBox计算的，需要重新定位到绝对右上角
  // 右边缘对齐：frame.width - box.w（让右边贴齐），然后左移62.5px
  // 顶部对齐：0，然后下移62.5px
  const alignedX = frame.width - box.w - 62.5  // 右边缘齐平后左移62.5px
  const alignedY = 62.5  // 顶部齐平后下移62.5px
  box = { ...box, x: alignedX, y: alignedY }
  
  drawCard(ctx, box, skin)
  const pad = skin.padding ?? 20
  
  // 获取有效圈数据
  const valid = frame.laps.filter(l => l.lapNum > 0 && l.lapTime > 0)
  if (valid.length === 0) return
  
  // 找到最快圈和当前圈
  // 注意: 最快圈应该只从已完成的圈中选择,排除当前正在跑的圈
  const completedLapsForBest = valid.filter(l => !l.isCurrent && l.lapTime > 0)
  const bestLap = completedLapsForBest.length > 0 
    ? completedLapsForBest.reduce((best, lap) => lap.lapTime < best.lapTime ? lap : best)
    : null
  const currentLap = frame.currentLap
  
  // 检测圈数变化,触发滚动动画
  const currentLapNum = frame.current?.lapNum ?? 0
  if (currentLapNum > lastLapNum && lastLapNum > 0) {
    scrollAnimStartTime = frame.playheadT
  }
  lastLapNum = currentLapNum
  
  // 计算滚动偏移
  let scrollOffset = 0
  const elapsed = frame.playheadT - scrollAnimStartTime
  if (elapsed < SCROLL_DURATION) {
    // 使用缓动函数: easeOutCubic
    const progress = elapsed / SCROLL_DURATION
    const eased = 1 - Math.pow(1 - progress, 3)
    const availH = box.h - pad * 2 - 28 - 20 // 总高度
    const lineH = availH / 5
    scrollOffset = lineH * (1 - eased) // 从1个行高滚动到0
  }
  
  // ===== 顶部：LAP | 秒差胶囊 | TIME =====
  const headerY = box.y + pad
  const capsuleHeight = 18  // 从22改为18,更扁
  const capsuleWidth = box.w - pad * 2 - 120  // 从160改为120,胶囊更宽
  const capsuleX = box.x + pad + 60  // 从80改为60
  const capsuleY = headerY
  
  // 数据列的X坐标
  const lapColX = box.x + pad + 12  // 从20改为12,更靠近边缘
  const timeColX = box.x + box.w - pad - 12  // 从20改为12,更靠近边缘
  
  // 绘制 "LAP" 标签(青色,更大)
  ctx.save()
  ctx.font = '700 18px "Arial", sans-serif'
  ctx.fillStyle = '#00ffff'  // 青色
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 3 }
  ctx.fillText('LAP', lapColX, capsuleY + capsuleHeight / 2)
  ctx.restore()
  
  // 绘制 "TIME" 标签(青色,更大)
  ctx.save()
  ctx.font = '700 18px "Arial", sans-serif'
  ctx.fillStyle = '#00ffff'  // 青色
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 3 }
  ctx.fillText('TIME', timeColX, capsuleY + capsuleHeight / 2)
  ctx.restore()
  
  // 绘制秒差胶囊(水平仪样式 - 横向)
  if (currentLap && frame.current) {
    // 使用数据源的bestCompare(现在已经修复,总是和已完成圈的最快圈比较)
    const bestCompare = frame.current.bestCompare ?? 0
    const deltaText = (bestCompare >= 0 ? '+' : '') + bestCompare.toFixed(2) + 's'
    
    const centerX = capsuleX + capsuleWidth / 2
    
    // 背景轨道(深灰色半透明)
    ctx.save()
    ctx.fillStyle = 'rgba(60,60,60,0.6)'
    roundRect(ctx, capsuleX + 2, capsuleY + 2, capsuleWidth - 4, capsuleHeight - 4, (capsuleHeight - 4) / 2)
    ctx.fill()
    ctx.restore()
    
    // 中线刻度(白色细线)
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(centerX, capsuleY + 3)
    ctx.lineTo(centerX, capsuleY + capsuleHeight - 3)
    ctx.stroke()
    ctx.restore()
    
    // 秒差进度条(横向,直线)
    // 注意: 如果bestCompare接近0(±0.05秒内),不显示进度条
    if (Number.isFinite(bestCompare) && Math.abs(bestCompare) > 0.05) {
      // 满格为 1 秒
      const FULL_SCALE = 1.0
      const ratio = Math.max(-1, Math.min(1, bestCompare / FULL_SCALE))
      const fillW = ((capsuleWidth - 4) / 2) * Math.abs(ratio)
      
      ctx.save()
      if (bestCompare < 0) {
        // 快(负数)：从中间往右延伸，绿色 #33cc33
        ctx.fillStyle = '#33cc33'
        ctx.fillRect(centerX, capsuleY + 2, fillW, capsuleHeight - 4)
      } else {
        // 慢(正数)：从中间往左延伸，红色
        ctx.fillStyle = '#ff4444'
        ctx.fillRect(centerX - fillW, capsuleY + 2, fillW, capsuleHeight - 4)
      }
      ctx.restore()
    }
    
    // 胶囊外框(白色,更细) - 画在最上层,遮盖进度条边缘
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2
    roundRect(ctx, capsuleX, capsuleY, capsuleWidth, capsuleHeight, capsuleHeight / 2)
    ctx.stroke()
    ctx.restore()
    
    // 秒差文字(白色粗体,带阴影)
    ctx.save()
    ctx.font = '700 13px "Arial", sans-serif'  // 字号从15改为13
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 4
    ctx.fillText(deltaText, centerX, capsuleY + capsuleHeight / 2)
    ctx.restore()
  }
  
  // ===== 圈速列表 =====
  const listStartY = headerY + capsuleHeight + 20
  const maxLaps = 5
  
  // 只显示当前圈及之前的圈(使用之前定义的currentLapNum)
  const relevantLaps = valid.filter(l => l.lapNum <= currentLapNum)
  
  // 已完成的圈(不包括当前圈)
  const completedLaps = relevantLaps.filter(l => !l.isCurrent && l.lapTime > 0)
  
  // 当前圈(如果存在)
  const currentLapData = relevantLaps.find(l => l.isCurrent)
  
  // 组合显示列表: 最近4圈已完成的 + 当前圈(如果有)
  let displayLaps = completedLaps.slice(Math.max(0, completedLaps.length - 4))
  if (currentLapData) {
    displayLaps = [...displayLaps, currentLapData]
  }
  
  const availH = box.h - pad * 2 - capsuleHeight - 20
  const lineH = availH / maxLaps
  const fontSize = Math.min(42, lineH * 0.75)
  
  displayLaps.forEach((lap, idx) => {
    const y = listStartY + idx * lineH + scrollOffset // 加上滚动偏移
    
    // 如果Y坐标超出可见区域,跳过绘制
    if (y < listStartY - lineH || y > box.y + box.h) return
    
    const isBest = bestLap && lap.lapNum === bestLap.lapNum
    const isCurrent = lap.isCurrent
    
    // 圈号颜色
    const lapColor = isBest ? '#a78bfa' : isCurrent ? '#4ade80' : 'rgba(255,255,255,0.6)'
    
    // 绘制圈号(粗体)
    ctx.save()
    ctx.font = `700 ${fontSize}px "Arial", sans-serif`
    ctx.fillStyle = lapColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
    ctx.fillText(String(lap.lapNum).padStart(2, '0'), lapColX, y)
    ctx.restore()
    
    // 绘制时间(已完成显示固定时间,当前圈显示实时计时)
    let timeStr
    if (isCurrent && frame.current) {
      // 当前圈: 显示实时用时 lapTimeInLap (毫秒)
      const currentLapTimeMs = frame.current.lapTimeInLap ?? 0
      timeStr = formatLapTime(currentLapTimeMs / 1000)
    } else {
      // 已完成的圈: 显示固定圈速
      timeStr = formatLapTime(lap.lapTime)
    }
    
    const timeColor = isBest ? '#a78bfa' : isCurrent ? '#4ade80' : 'rgba(255,255,255,0.95)'
    ctx.save()
    ctx.font = `700 ${fontSize}px "Arial", sans-serif`
    ctx.fillStyle = timeColor
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
    ctx.fillText(timeStr, timeColX, y)
    ctx.restore()
  })
}

/** 格式化圈速时间 */
function formatLapTime(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${min}'${sec.toString().padStart(2, '0')}"${ms.toString().padStart(3, '0')}`
}

/** 自定义速度表 + G力球组合（从8点钟到2点钟的弧线） */
function drawCustomSpeedGauge(
  ctx: CanvasRenderingContext2D,
  box: Box,
  frame: HudFrame,
  skin: WidgetSkin,
) {
  const speed = frame.current?.speed ?? 0
  const gLong = frame.current?.gLong ?? 0  // 纵向G力
  const gLat = frame.current?.gLat ?? 0    // 横向G力
  const currentLapNum = frame.current?.lapNum ?? 0
  const currentTime = frame.playheadT
  
  // 弯道检测：基于速度变化率和横向G力
  detectCornerAndRecordSpeed(speed, gLat, currentTime, currentLapNum, frame.current?.lat ?? 0, frame.current?.lng ?? 0)
  
  // 检测圈数变化,重置当前圈极值和刹车点
  if (currentLapNum !== lastRecordedLapNum && lastRecordedLapNum > 0) {
    currentLapMaxLeft = 0
    currentLapMaxRight = 0
    currentLapMaxAccel = 0
    currentLapMaxBrake = 0
    brakePoints = [] // 新圈清空刹车点
  }
  lastRecordedLapNum = currentLapNum
  
  // 计算最高和最低速度
  let maxSpd = 0
  let minSpd = Infinity
  for (const s of frame.samples) {
    if (s.speed > maxSpd) maxSpd = s.speed
    if (s.speed < minSpd && s.speed > 0) minSpd = s.speed
  }
  if (maxSpd < 1) maxSpd = 120
  if (minSpd === Infinity) minSpd = 0
  
  const ratio = Math.max(0, Math.min(1, speed / maxSpd))

  // 不绘制背景卡片，保持透明
  // drawCard(ctx, box, skin)

  // G球和速度表中心坐标 - 下移45px（90-45）
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2 + 45
  const r = Math.min(box.w, box.h) * 0.35
  
  // 弧线角度：从8点钟位置到2点钟位置
  // 直接测试：8点钟应该在左下，2点钟应该在右上
  const startAng = (140 * Math.PI) / 180  // 先试210度
  const endAng = (320 * Math.PI) / 180    // 210 + 210 = 420度（相当于60度）
  const totalAng = endAng - startAng
  const fillAng = startAng + totalAng * ratio

  ctx.save()
  ctx.lineCap = 'round'
  
  // 背景轨道 - 从8点钟到2点钟（黑色半透明，和右侧列表一致）
  ctx.beginPath()
  ctx.arc(cx, cy, r, startAng, endAng)
  ctx.strokeStyle = 'rgba(0,0,0,0.50)'  // 改为黑色50%透明度
  ctx.lineWidth = Math.max(4, r * 0.10)
  ctx.stroke()
  
  // 填充弧（使用线性渐变：绿色→黄色→橙红色）
  // 创建从起点到终点的渐变
  const startX = cx + Math.cos(startAng) * r
  const startY = cy + Math.sin(startAng) * r
  const endX = cx + Math.cos(endAng) * r
  const endY = cy + Math.sin(endAng) * r
  
  const gradient = ctx.createLinearGradient(startX, startY, endX, endY)
  gradient.addColorStop(0, '#4ade80')    // 绿色
  gradient.addColorStop(0.5, '#fbbf24')  // 黄色
  gradient.addColorStop(1, '#ef4444')    // 红色
  
  ctx.beginPath()
  ctx.arc(cx, cy, r, startAng, fillAng)
  ctx.strokeStyle = gradient
  ctx.stroke()
  ctx.restore()

  // 中心G力球背景 - 三层同心圆（都用黑色，透明度每圈递减10%）
  const gBallR = r * 0.82  // 继续增大,更贴近速度弧线
  const ringGap = gBallR * 0.25  // 每圈之间的间距调大
  
  // 最外层（黑色，50%透明度）
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, gBallR, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(0,0,0,0.50)'
  ctx.fill()
  ctx.restore()
  
  // 中间层（黑色，40%透明度）
  const midR = gBallR - ringGap
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, midR, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(0,0,0,0.40)'
  ctx.fill()
  ctx.restore()
  
  // 最内层（黑色，30%透明度）
  const innerR = midR - ringGap
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(0,0,0,0.30)'
  ctx.fill()
  ctx.restore()

  // G力球十字线
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - gBallR, cy)
  ctx.lineTo(cx + gBallR, cy)
  ctx.moveTo(cx, cy - gBallR)
  ctx.lineTo(cx, cy + gBallR)
  ctx.stroke()
  ctx.restore()

  // 更新极值并记录痕迹 - 已禁用渐隐效果
  const MAX_G = 3
  const gLatNorm = -gLat / MAX_G  // 横向G力（反向）
  const gLongNorm = -gLong / MAX_G // 纵向G力（反向）
  
  // 检测极值 - 不再添加痕迹
  // const THRESHOLD = 0.1 // 极值变化阈值（避免抖动）
  
  // // 左转极值（gLat为负，球往右）
  // if (gLat < 0 && Math.abs(gLat) > currentLapMaxLeft + THRESHOLD) {
  //   currentLapMaxLeft = Math.abs(gLat)
  //   const trailX = cx + gLatNorm * gBallR * 0.8
  //   const trailY = cy + gLongNorm * gBallR * 0.8
  //   addGTrail(trailX, trailY, currentTime, 'left', Math.abs(gLat))
  // }
  
  // // 右转极值（gLat为正，球往左）
  // if (gLat > 0 && Math.abs(gLat) > currentLapMaxRight + THRESHOLD) {
  //   currentLapMaxRight = Math.abs(gLat)
  //   const trailX = cx + gLatNorm * gBallR * 0.8
  //   const trailY = cy + gLongNorm * gBallR * 0.8
  //   addGTrail(trailX, trailY, currentTime, 'right', Math.abs(gLat))
  // }
  
  // // 加速极值（gLong为负）
  // if (gLong < 0 && Math.abs(gLong) > currentLapMaxAccel + THRESHOLD) {
  //   currentLapMaxAccel = Math.abs(gLong)
  //   const trailX = cx + gLatNorm * gBallR * 0.8
  //   const trailY = cy + gLongNorm * gBallR * 0.8
  //   addGTrail(trailX, trailY, currentTime, 'accel', Math.abs(gLong))
  // }
  
  // // 刹车极值（gLong为正）
  // if (gLong > 0 && Math.abs(gLong) > currentLapMaxBrake + THRESHOLD) {
  //   currentLapMaxBrake = Math.abs(gLong)
  //   const trailX = cx + gLatNorm * gBallR * 0.8
  //   const trailY = cy + gLongNorm * gBallR * 0.8
  //   addGTrail(trailX, trailY, currentTime, 'brake', Math.abs(gLong))
  // }
  
  // lastGLat = gLat  // 未使用，注释掉
  // lastGLong = gLong  // 未使用，注释掉
  
  // 绘制渐消失的极值痕迹 - 已禁用
  // drawGTrails(ctx, currentTime)

  // G力点（青色双层圆圈）- 在痕迹之上绘制
  const dotX = cx + gLatNorm * gBallR * 0.8
  const dotY = cy + gLongNorm * gBallR * 0.8
  
  // 外圈（深色）
  ctx.save()
  ctx.beginPath()
  ctx.arc(dotX, dotY, 10, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(0, 229, 255, 0.25)'  // 更透明的青色
  if (skin.textShadow) { ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 12 }
  ctx.fill()
  ctx.restore()
  
  // 内圈（亮色）
  ctx.save()
  ctx.beginPath()
  ctx.arc(dotX, dotY, 5, 0, 2 * Math.PI)
  ctx.fillStyle = '#00e5ff'  // 纯青色
  if (skin.textShadow) { ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 8 }
  ctx.fill()
  ctx.restore()

  // G力总值显示在G球中心（按设计图要求）- 暂时隐藏
  // const gTotal = Math.sqrt(gLong * gLong + gLat * gLat)  // 未使用
  // ctx.save()
  // const gFontSize = Math.round(r * 0.35)
  // ctx.font = `700 ${gFontSize}px ${skin.numFont}`
  // ctx.fillStyle = '#ffffff'
  // ctx.textAlign = 'center'
  // ctx.textBaseline = 'middle'
  // if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  // ctx.fillText(`${gTotal.toFixed(1)}G`, cx, cy)
  // ctx.restore()

  // R-值标签（G力球底部居中位置，浅灰色背景，白色文字）
  ctx.save()
  const rLabelSize = Math.round(r * 0.13)  // 从0.16改为0.13，更小
  
  // 缩小盒子尺寸，更精致
  const rBgW = rLabelSize * 4.5
  const rBgH = rLabelSize + 4     // 从6改为4，更紧凑
  
  // 位置：G球底部居中
  const rBgX = cx - rBgW / 2
  const rBgY = cy + gBallR - rBgH - 10
  
  // 绘制半透明背景（浅灰色，更精致）
  ctx.fillStyle = 'rgba(200,200,200,0.25)'
  roundRect(ctx, rBgX, rBgY, rBgW, rBgH, 3)  // 从4改为3，圆角更小
  ctx.fill()
  
  // 可选：添加边框让盒子更精致
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 0.5
  roundRect(ctx, rBgX, rBgY, rBgW, rBgH, 3)
  ctx.stroke()
  
  // 使用Arial字体，白色
  ctx.font = `700 ${rLabelSize}px "Arial", sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 3 }
  
  // 构建文本
  const gValue = Math.abs(gLat).toFixed(1)
  const rText = `R-${gValue}G`
  
  // 居中绘制（文字内容下移1.5px）
  ctx.textAlign = 'center'
  ctx.fillText(rText, cx, rBgY + rBgH / 2 + 1.5)
  ctx.restore()

  // 速度数字（左上角外侧，固定位置，右对齐避免跳动）
  const speedX = cx - r * 1.8  // 从2.1改为1.8，往右移
  const speedY = cy - r * 0.8
  ctx.save()
  const numFontSize = Math.round(box.h * 0.11)  // 调整为0.11
  ctx.font = `700 ${numFontSize}px ${skin.numFont}`
  ctx.fillStyle = skin.textColor
  ctx.textAlign = 'right'  // 改为右对齐
  ctx.textBaseline = 'middle'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 6 }
  // 给数字预留固定宽度（3位数的空间）
  const numberX = speedX + numFontSize * 2  // 固定位置
  ctx.fillText(String(Math.round(speed)), numberX, speedY)
  ctx.restore()

  // 单位（数字右侧固定位置）
  ctx.save()
  const unitSize = Math.round(numFontSize * 0.35)
  ctx.font = `700 ${unitSize}px "Rajdhani", sans-serif`
  ctx.fillStyle = skin.textDimColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'  // 与数字同一基线
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  const unitText = frame.unit === 'mph' ? 'MPH' : 'KM/H'
  ctx.fillText(unitText, numberX + 8, speedY)  // 固定距离
  ctx.restore()

  // 0刻度（8点钟位置，左下角）
  const zeroAng = startAng
  const zeroX = cx + Math.cos(zeroAng) * (r + 18)
  const zeroY = cy + Math.sin(zeroAng) * (r + 18)
  ctx.save()
  const scaleSize = Math.round(r * 0.24)  // 从0.32改为0.24
  ctx.font = `700 ${scaleSize}px "Rajdhani", sans-serif`
  ctx.fillStyle = skin.textDimColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  ctx.fillText('0', zeroX, zeroY)
  ctx.restore()

  // 最大刻度（2点钟位置，右上角）
  const maxAng = endAng
  const maxX = cx + Math.cos(maxAng) * (r + 28)  // 改为28
  const maxY = cy + Math.sin(maxAng) * (r + 28)
  ctx.save()
  ctx.font = `700 ${scaleSize}px "Rajdhani", sans-serif`
  ctx.fillStyle = skin.textDimColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  if (skin.textShadow) { ctx.shadowColor = skin.textShadow; ctx.shadowBlur = 4 }
  ctx.fillText(String(Math.round(maxSpd)), maxX, maxY)
  ctx.restore()
  
  // 绘制弯道速度标签（右侧）
  drawCornerSpeedLabels(ctx, cx, cy, r, frame, currentTime)
}

export const customTheme: Theme = {
  id: 'custom',
  name: 'DSK专属',
  preview: {
    bg: '#1e293b', // 深蓝灰色
    border: 'rgba(255,255,255,0.13)',
    text: '#ffffff',
    accent: '#00e5ff', // 青色
  },
  drawHud(ctx, frame) {
    // 右下角：自定义赛道地图（无背景、无TRACK字样）
    drawCustomMiniMap(ctx, pctBox(frame, 'br', 0.02, 0.04, 0.18, 0.28), frame, MAP_SKIN)
    
    // 右上角：自定义圈速信息面板（缩小宽度到16%）
    drawCustomLapList(ctx, pctBox(frame, 'tr', 0.02, 0.02, 0.16, 0.20), frame, DARK_CARD_SKIN)
    
    // 左下角：自定义速度表
    drawCustomSpeedGauge(ctx, pctBox(frame, 'bl', 0.02, 0.04, 0.18, 0.28), frame, TRANSPARENT_SKIN)
  },
}

// 无圈速版主题
export const customNoLapTheme: Theme = {
  id: 'custom-no-lap',
  name: 'DSK专属（无圈速版）',
  preview: {
    bg: '#1e293b', // 深蓝灰色
    border: 'rgba(255,255,255,0.13)',
    text: '#ffffff',
    accent: '#00e5ff', // 青色
  },
  drawHud(ctx, frame) {
    // 右下角：自定义赛道地图（无背景、无TRACK字样）
    drawCustomMiniMap(ctx, pctBox(frame, 'br', 0.02, 0.04, 0.18, 0.28), frame, MAP_SKIN)
    
    // 不绘制右上角圈速列表
    
    // 左下角：自定义速度表
    drawCustomSpeedGauge(ctx, pctBox(frame, 'bl', 0.02, 0.04, 0.18, 0.28), frame, TRANSPARENT_SKIN)
  },
}

/** 添加G力痕迹 */
function addGTrail(x: number, y: number, timestamp: number, type: GTrail['type'], gValue: number) {
  // 检查是否与最近的同类型痕迹距离太近（避免重复）
  const MIN_DISTANCE = 5
  const recentSameType = gTrails.filter(t => t.type === type && timestamp - t.timestamp < 500)
  for (const t of recentSameType) {
    const dist = Math.hypot(x - t.x, y - t.y)
    if (dist < MIN_DISTANCE) return // 距离太近，不添加
  }
  
  gTrails.push({ x, y, timestamp, type, gValue })
  
  // 限制每个类型的痕迹数量
  const sameTypeTrails = gTrails.filter(t => t.type === type)
  if (sameTypeTrails.length > MAX_TRAILS_PER_TYPE) {
    const oldestIndex = gTrails.indexOf(sameTypeTrails[0])
    if (oldestIndex >= 0) gTrails.splice(oldestIndex, 1)
  }
}

/** 绘制所有G力痕迹（渐消失效果） */
function drawGTrails(ctx: CanvasRenderingContext2D, currentTime: number) {
  // 清理过期的痕迹
  for (let i = gTrails.length - 1; i >= 0; i--) {
    if (currentTime - gTrails[i].timestamp > TRAIL_FADE_DURATION) {
      gTrails.splice(i, 1)
    }
  }
  
  // 绘制痕迹
  const colors = {
    left: '#ff6b9d',    // 粉红（左转）
    right: '#4dabf7',   // 蓝色（右转）
    accel: '#51cf66',   // 绿色（加速）
    brake: '#ff8787',   // 红色（刹车）
  }
  
  for (const trail of gTrails) {
    const age = currentTime - trail.timestamp
    const fadeProgress = age / TRAIL_FADE_DURATION
    const opacity = 1 - fadeProgress
    
    if (opacity <= 0) continue
    
    const baseColor = colors[trail.type]
    
    // 绘制外圈（大圆，更透明）
    ctx.save()
    ctx.globalAlpha = opacity * 0.3
    ctx.beginPath()
    ctx.arc(trail.x, trail.y, 12, 0, 2 * Math.PI)
    ctx.fillStyle = baseColor
    ctx.fill()
    ctx.restore()
    
    // 绘制内圈（小圆，更实）
    ctx.save()
    ctx.globalAlpha = opacity * 0.6
    ctx.beginPath()
    ctx.arc(trail.x, trail.y, 6, 0, 2 * Math.PI)
    ctx.fillStyle = baseColor
    ctx.fill()
    ctx.restore()
    
    // 中心点
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.beginPath()
    ctx.arc(trail.x, trail.y, 2, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()
  }
}

/** 弯道检测：基于速度变化率（更可靠） */
function detectCornerAndRecordSpeed(speed: number, gLat: number, currentTime: number, _lapNum: number, lat: number, lng: number) {
  // 维护速度历史
  recentSpeedHistory.push({ speed, time: currentTime })
  recentSpeedHistory = recentSpeedHistory.filter(h => currentTime - h.time < SPEED_HISTORY_DURATION)
  
  // 计算速度变化率（加速度）
  let speedDropRate = 0
  if (lastSpeedTime > 0) {
    const timeDiff = (currentTime - lastSpeedTime) / 1000 // 转换为秒
    if (timeDiff > 0) {
      speedDropRate = (speed - lastSpeed) / timeDiff // km/h/s
    }
  }
  lastSpeed = speed
  lastSpeedTime = currentTime
  
  const isHighG = Math.abs(gLat) > CORNER_G_THRESHOLD
  const isBraking = speedDropRate < SPEED_DROP_RATE_THRESHOLD // 速度快速下降
  const isAccelerating = speedDropRate > 3 // 速度开始回升（出弯信号）
  
  // 状态机
  if (isBraking && !inBrakingPhase) {
    // 检测到刹车开始（速度开始快速下降）- 只在这一刻记录刹车点
    inBrakingPhase = true
    brakingStartSpeed = speed
    
    // 记录刹车点位置（只记录一次，刹车开始的位置）
    brakePoints.push({ lat, lng, timestamp: currentTime })
    
    // 从最近2秒的速度历史中找最高速度（刹车前的最高速度）
    const recent2sec = recentSpeedHistory.filter(h => currentTime - h.time < 2000)
    const maxSpeed = recent2sec.length > 0 
      ? Math.max(...recent2sec.map(h => h.speed))
      : speed
    
    // 如果同时有横向G力，说明是刹车入弯
    if (isHighG) {
      inCornerState = true
      cornerStartTime = currentTime
      currentCorner = {
        maxSpeed: maxSpeed,
        minSpeed: speed,
        timestamp: currentTime,
        isActive: true,
        brakePoint: { lat, lng } // 记录刹车点
      }
    }
  }
  
  if (inBrakingPhase) {
    // 在刹车/过弯阶段
    if (isHighG && !inCornerState) {
      // 刹车后开始转向，进入弯道
      inCornerState = true
      cornerStartTime = currentTime
      
      const recent2sec = recentSpeedHistory.filter(h => currentTime - h.time < 2000)
      const maxSpeed = recent2sec.length > 0 
        ? Math.max(...recent2sec.map(h => h.speed))
        : brakingStartSpeed
      
      currentCorner = {
        maxSpeed: maxSpeed,
        minSpeed: speed,
        timestamp: currentTime,
        isActive: true,
        brakePoint: brakePoints.length > 0 ? brakePoints[brakePoints.length - 1] : { lat, lng }
      }
    }
    
    if (inCornerState && currentCorner) {
      // 更新弯中最低速度
      if (speed < currentCorner.minSpeed) {
        currentCorner.minSpeed = speed
      }
    }
    
    // 检测出弯：速度开始回升 + G力降低
    if (isAccelerating && !isHighG && inCornerState && currentCorner) {
      const cornerDuration = currentTime - cornerStartTime
      const speedDrop = currentCorner.maxSpeed - currentCorner.minSpeed
      
      // 判断是否为有效的刹车弯道
      if (cornerDuration > CORNER_MIN_DURATION && speedDrop > CORNER_SPEED_DROP) {
        // 有效弯道，标记为完成（isActive = false）
        currentCorner.isActive = false
        currentCorner.timestamp = currentTime
        lastCornerDisplay = { ...currentCorner }
      }
      
      // 重置状态
      inBrakingPhase = false
      inCornerState = false
      currentCorner = null
    }
  }
}

/** 绘制弯道速度标签 */
function drawCornerSpeedLabels(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  frame: HudFrame,
  currentTime: number
) {
  // 只显示已完成的弯道数据（出弯后）
  // 弯道进行中（currentCorner.isActive）不显示
  let displayData: CornerSpeed | null = null
  let opacity = 1
  
  if (lastCornerDisplay && !lastCornerDisplay.isActive) {
    // 只显示已完成的弯道（isActive = false）
    const elapsed = currentTime - lastCornerDisplay.timestamp
    if (elapsed < CORNER_DISPLAY_DURATION) {
      displayData = lastCornerDisplay
      
      // 动画效果：稳定显示，最后1秒渐隐
      const fadeStartTime = CORNER_DISPLAY_DURATION - 1000
      if (elapsed > fadeStartTime) {
        // 渐隐效果（最后1秒）
        opacity = 1 - ((elapsed - fadeStartTime) / 1000)
      } else {
        opacity = 1
      }
    } else {
      lastCornerDisplay = null
    }
  }
  
  if (!displayData) return
  
  // 标签位置：速度表右侧（往右移避免遮挡G球）
  const labelX = cx + r * 1.5  // 从1.2改为1.5，往右移
  const labelW = r * 2.2
  const labelH = r * 0.35
  // const labelGap = r * 0.15  // 未使用
  
  const maxLabelY = cy - r * 0.4
  const minLabelY = cy + r * 0.2
  
  ctx.save()
  ctx.globalAlpha = opacity
  
  // 上方：绿色 Max Speed 标签
  ctx.fillStyle = 'rgba(76, 175, 80, 0.9)'  // 绿色
  roundRect(ctx, labelX, maxLabelY, labelW, labelH, 6)
  ctx.fill()
  
  // Max Speed 文字
  const maxFontSize = Math.round(labelH * 0.45)
  ctx.font = `700 ${maxFontSize}px "Arial", sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Max Speed', labelX + labelH * 0.3, maxLabelY + labelH * 0.5)
  
  // 速度数字（右侧）
  const speedFontSize = Math.round(labelH * 0.55)
  ctx.font = `700 ${speedFontSize}px "Arial", sans-serif`
  ctx.textAlign = 'right'
  const unit = frame.unit === 'mph' ? 'mph' : 'km/h'
  ctx.fillText(`${Math.round(displayData.maxSpeed)}${unit}`, labelX + labelW - labelH * 0.3, maxLabelY + labelH * 0.5)
  
  // 下方：红色/橙色 Min Speed 标签
  ctx.fillStyle = 'rgba(255, 87, 34, 0.9)'  // 橙红色
  roundRect(ctx, labelX, minLabelY, labelW, labelH, 6)
  ctx.fill()
  
  // Min Speed 文字
  ctx.font = `700 ${maxFontSize}px "Arial", sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Min Speed', labelX + labelH * 0.3, minLabelY + labelH * 0.5)
  
  // 速度数字（右侧）
  ctx.font = `700 ${speedFontSize}px "Arial", sans-serif`
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.round(displayData.minSpeed)}${unit}`, labelX + labelW - labelH * 0.3, minLabelY + labelH * 0.5)
  
  ctx.restore()
}
