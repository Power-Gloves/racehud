/**
 * 主题：霓虹
 * 风格：deep navy 底 + 青色发光描边，赛博朋克感
 */
import type { Theme } from '../types'
import {
  drawSpeedGauge, drawLapInfo, drawLapList, drawGForceBall, drawMiniMap,
  pctBox, type WidgetSkin,
} from '../widgets'

const SKIN: WidgetSkin = {
  bg: 'rgba(0,8,20,0.7)',
  border: '#22d3ee',
  borderWidth: 1,
  radius: 2,
  padding: 10,
  textColor: '#22d3ee',
  textDimColor: '#67e8f9',
  accentColor: '#ec4899',
  goodColor: '#a3e635',
  warnColor: '#fb7185',
  numFont: '"Aldrich", "Open Sans", monospace',
  labelFont: '600 11px "Aldrich", sans-serif',
  textShadow: 'rgba(34, 211, 238, 0.55)',
}

export const neonTheme: Theme = {
  id: 'neon',
  name: '霓虹',
  preview: { bg: '#000814', border: '#22d3ee', text: '#22d3ee', accent: '#ec4899' },
  drawHud(ctx, frame) {
    drawMiniMap(ctx, pctBox(frame, 'tl', 0.02, 0.02, 0.13, 0.20), frame, SKIN)
    drawLapInfo(ctx, pctBox(frame, 'tc', 0, 0.02, 0.30, 0.10), frame, SKIN)
    drawLapList(ctx, pctBox(frame, 'tr', 0.02, 0.02, 0.14, 0.30), frame, SKIN)
    drawSpeedGauge(ctx, pctBox(frame, 'bl', 0.02, 0.04, 0.16, 0.22), frame, SKIN)
    drawGForceBall(ctx, pctBox(frame, 'br', 0.02, 0.04, 0.13, 0.20), frame, SKIN)
  },
}
