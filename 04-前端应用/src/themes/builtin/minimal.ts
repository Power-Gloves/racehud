/**
 * 主题：极简
 *
 * 设计理念：真正的极简——克制、纯净、有呼吸感
 *   - 纯白文字 + 单一青色点缀，无杂色
 *   - 暗光晕轻量化，保证亮背景可读但不浑浊
 *   - 速度（左下）为视觉主角，圈速差（顶部）为核心指标
 *   - 地图、G球轻量呈现，不喧宾夺主
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

/** 透明 skin：轻量暗光晕 + 纯白文字，极简核心 */
const TRANSPARENT_SKIN: WidgetSkin = {
  glow: { color: '#000000', opacity: 0.14 },  // 从0.20降到0.14，更轻
  padding: 8,
  textColor: '#ffffff',
  textDimColor: '#e2e8f0',   // 提亮 dim 色，减少灰浊感
  accentColor: '#38bdf8',    // 更柔和的天青色
  goodColor: '#34d399',
  warnColor: '#fb7185',
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,0,0,0.9)',
}

/** 卡片 skin：极简半透明黑底，弱边框，大圆角更柔和 */
const CARD_SKIN: WidgetSkin = {
  bg: 'rgba(0,0,0,0.42)',         // 从0.55降到0.42，更通透
  border: 'rgba(255,255,255,0.06)',  // 边框更弱
  borderWidth: 1,
  radius: 12,                      // 从6增到12，更柔和现代
  padding: 12,
  textColor: '#ffffff',
  textDimColor: '#cbd5e1',
  accentColor: '#38bdf8',
  goodColor: '#34d399',
  warnColor: '#fb7185',
  numFont: NUM_FONT,
  labelFont: LABEL_FONT,
  textShadow: 'rgba(0,0,0,0.85)',
}

export const minimalTheme: Theme = {
  id: 'minimal',
  name: '极简',
  preview: {
    bg: '#0a0a0a',
    border: 'rgba(255,255,255,0.13)',
    text: '#ffffff',
    accent: '#38bdf8',
  },
  drawHud(ctx, frame) {
    // 左上：迷你地图（轻量透明，不用卡片）
    drawMiniMap(ctx, pctBox(frame, 'tl', 0.025, 0.03, 0.12, 0.19), frame, TRANSPARENT_SKIN)
    // 顶部居中：圈速核心信息（极简卡片）
    drawLapInfo(ctx, pctBox(frame, 'tc', 0, 0.03, 0.30, 0.10), frame, CARD_SKIN)
    // 右上：圈榜（极简卡片，BEST + 最近4圈）
    drawLapList(ctx, pctBox(frame, 'tr', 0.025, 0.03, 0.15, 0.22), frame, CARD_SKIN, { maxRecentLines: 4 })
    // 左下：速度（视觉主角，透明叠加）
    drawSpeedGauge(ctx, pctBox(frame, 'bl', 0.025, 0.05, 0.17, 0.23), frame, TRANSPARENT_SKIN)
    // 右下：G球（轻量透明）
    drawGForceBall(ctx, pctBox(frame, 'br', 0.025, 0.05, 0.12, 0.19), frame, TRANSPARENT_SKIN)
  },
}
