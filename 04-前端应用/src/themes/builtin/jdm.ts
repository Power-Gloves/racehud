/**
 * 主题：JDM 红黑
 * 风格：日系改装车风——红黑配色 + 锐利边框，激进感
 */
import type { Theme } from '../types'
import {
  drawSpeedGauge, drawLapInfo, drawLapList, drawGForceBall, drawMiniMap,
  pctBox, type WidgetSkin,
} from '../widgets'

const SKIN: WidgetSkin = {
  bg: 'rgba(15,0,0,0.88)',
  border: '#ef4444',
  borderWidth: 1,
  radius: 4,
  padding: 10,
  textColor: '#fee2e2',
  textDimColor: '#fca5a5',
  accentColor: '#fbbf24',
  goodColor: '#86efac',
  warnColor: '#ffffff',
  numFont: '"Aldrich", "Open Sans", monospace',
  labelFont: '700 11px "Aldrich", sans-serif',
  textShadow: 'rgba(239, 68, 68, 0.4)',
}

export const jdmTheme: Theme = {
  id: 'jdm',
  name: 'JDM 红黑',
  preview: { bg: '#0f0000', border: '#ef4444', text: '#ef4444', accent: '#fbbf24' },
  drawHud(ctx, frame) {
    drawMiniMap(ctx, pctBox(frame, 'tl', 0.02, 0.02, 0.13, 0.20), frame, SKIN)
    drawLapInfo(ctx, pctBox(frame, 'tc', 0, 0.02, 0.30, 0.10), frame, SKIN)
    drawLapList(ctx, pctBox(frame, 'tr', 0.02, 0.02, 0.14, 0.30), frame, SKIN)
    drawSpeedGauge(ctx, pctBox(frame, 'bl', 0.02, 0.04, 0.16, 0.22), frame, SKIN)
    drawGForceBall(ctx, pctBox(frame, 'br', 0.02, 0.04, 0.13, 0.20), frame, SKIN)
  },
}
