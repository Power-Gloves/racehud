/**
 * 主题：极简
 *
 * 字体：Orbitron（赛车/航天感数字字体）+ Rajdhani（窄体科技标签）
 * 风格：
 *   - 速度仪表 / G 球 / 迷你赛道 = 透明叠加 + 径向暗光晕（保证亮背景下可读）
 *   - 顶部圈信息 / 右侧圈榜 = 半透明卡片背景
 *   - 圈榜紧凑、固定列宽，最近 6 圈
 */
import type { Theme } from '../types'
import {
  drawSpeedGauge, drawLapInfo, drawLapList, drawGForceBall, drawMiniMap,
  pctBox, type WidgetSkin,
} from '../widgets'

// 数字用 Aldrich（等宽科技字体，每位数字宽度一致，不跳动）
// 标签用 Rajdhani（窄体科技感）
const NUM_FONT = '"Aldrich", "Open Sans", sans-serif'
const LABEL_FONT = '600 12px "Rajdhani", "Open Sans", sans-serif'

/** 透明 skin：径向暗光晕 + 重文字阴影，无矩形背景但有可读性 */
const TRANSPARENT_SKIN: WidgetSkin = {
  glow: { color: '#000000', opacity: 0.20 },
  padding: 8,
  textColor: '#ffffff',
  textDimColor: '#cbd5e1',
  accentColor: '#22d3ee',
  goodColor: '#10b981',
  warnColor: '#f43f5e',
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,0,0,0.95)',
}

/** 卡片 skin：保留半透明黑底，用于圈信息 / 圈榜（信息密集需要明确边界） */
const CARD_SKIN: WidgetSkin = {
  bg: 'rgba(0,0,0,0.55)',
  border: 'rgba(255,255,255,0.10)',
  borderWidth: 1,
  radius: 6,
  padding: 10,
  textColor: '#ffffff',
  textDimColor: '#94a3b8',
  accentColor: '#22d3ee',
  goodColor: '#10b981',
  warnColor: '#f43f5e',
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,0,0,0.85)',
}

export const minimalTheme: Theme = {
  id: 'minimal',
  name: '极简',
  preview: {
    bg: '#000000',
    border: 'rgba(255,255,255,0.13)',
    text: '#ffffff',
    accent: '#22d3ee',
  },
  drawHud(ctx, frame) {
    drawMiniMap(ctx, pctBox(frame, 'tl', 0.02, 0.02, 0.13, 0.20), frame, TRANSPARENT_SKIN)
    drawLapInfo(ctx, pctBox(frame, 'tc', 0, 0.02, 0.32, 0.10), frame, CARD_SKIN)
    // 圈榜：宽度收窄到 12%，高度也收窄；最近 6 圈
    drawLapList(ctx, pctBox(frame, 'tr', 0.02, 0.02, 0.16, 0.22), frame, CARD_SKIN, { maxLines: 4 })
    drawSpeedGauge(ctx, pctBox(frame, 'bl', 0.02, 0.04, 0.16, 0.22), frame, TRANSPARENT_SKIN)
    drawGForceBall(ctx, pctBox(frame, 'br', 0.02, 0.04, 0.13, 0.20), frame, TRANSPARENT_SKIN)
  },
}
