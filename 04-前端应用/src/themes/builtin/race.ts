/**
 * 主题：赛道荧光
 * 风格：荧光绿 + 深绿底，赛道感、专业感
 */
import type { Theme } from '../types'
import {
  drawSpeedGauge, drawLapInfo, drawLapList, drawGForceBall, drawMiniMap,
  pctBox, type WidgetSkin,
} from '../widgets'

const SKIN: WidgetSkin = {
  bg: 'rgba(0,31,15,0.85)',
  border: 'rgba(34,197,94,0.6)',
  borderWidth: 1,
  radius: 4,
  padding: 10,
  textColor: '#bbf7d0',
  textDimColor: '#86efac',
  accentColor: '#facc15',
  goodColor: '#4ade80',
  warnColor: '#f87171',
  numFont: '"Aldrich", "Open Sans", monospace',
  labelFont: '600 11px "Aldrich", sans-serif',
  textShadow: 'rgba(34,197,94,0.35)',
}

export const raceTheme: Theme = {
  id: 'race',
  name: '赛道荧光',
  preview: { bg: '#001f0f', border: '#22c55e', text: '#86efac', accent: '#facc15' },
  drawHud(ctx, frame) {
    drawMiniMap(ctx, pctBox(frame, 'tl', 0.02, 0.02, 0.13, 0.20), frame, SKIN)
    drawLapInfo(ctx, pctBox(frame, 'tc', 0, 0.02, 0.30, 0.10), frame, SKIN)
    drawLapList(ctx, pctBox(frame, 'tr', 0.02, 0.02, 0.14, 0.30), frame, SKIN)
    drawSpeedGauge(ctx, pctBox(frame, 'bl', 0.02, 0.04, 0.16, 0.22), frame, SKIN)
    drawGForceBall(ctx, pctBox(frame, 'br', 0.02, 0.04, 0.13, 0.20), frame, SKIN)
  },
}
