import type { HudFrame, Theme } from './types'
import { drawStartLights } from './startLights'

/** 预览与导出共用：先绘制主题，再绘制单圈冲线效果。 */
export function renderHud(ctx: CanvasRenderingContext2D, theme: Theme, frame: HudFrame) {
  ctx.save()
  try { theme.drawHud(ctx, frame) } finally { ctx.restore() }
  drawStartLights(ctx, frame.width, frame.height, frame.playheadT, frame.startLights)
}
