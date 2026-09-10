import type { LapInfo } from '../types'
import { gpsToVideo } from '../telemetry/time'

export interface StartLightsCue {
  /** 所选圈起点，GPS 毫秒。 */
  startT: number
  leadInMs: number
}

export function createStartLightsCue(options: {
  enabled: boolean
  mode: 'full' | 'lap' | 'custom'
  lap?: LapInfo
  bufferBefore: number
  dataStartT: number
  dataOffsetMs: number
  videoOffsetMs: number
  videoDuration: number
}): StartLightsCue | undefined {
  const { lap } = options
  if (!options.enabled || options.mode !== 'lap' || !lap) return undefined
  const startSec = gpsToVideo(lap.startT, options.dataStartT, options.dataOffsetMs, options.videoOffsetMs)
  const leadInMs = Math.min(5, options.bufferBefore, startSec) * 1000
  if (!Number.isFinite(leadInMs) || leadInMs <= 0 || startSec >= options.videoDuration) return undefined
  return { startT: lap.startT, leadInMs }
}

/** 纯时间函数：往回拖动与连续播放得到完全相同的灯光。 */
export function getStartLightsState(t: number, cue?: StartLightsCue) {
  if (!cue || !Number.isFinite(t) || !Number.isFinite(cue.startT) || !(cue.leadInMs > 0)) return null
  const elapsed = t - (cue.startT - cue.leadInMs)
  const afterLine = t - cue.startT
  if (elapsed < 0 || afterLine >= 450) return null
  return {
    lit: afterLine >= 0 ? 0 : Math.min(5, Math.floor(elapsed / (cue.leadInMs / 5)) + 1),
    opacity: afterLine <= 200 ? 1 : (450 - afterLine) / 250,
  }
}

export function drawStartLights(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, cue?: StartLightsCue) {
  const state = getStartLightsState(t, cue)
  if (!state) return
  ctx.save()
  try {
    ctx.globalAlpha = state.opacity
    const scale = width / 1920
    ctx.translate(width / 2, height * .25)
    ctx.scale(scale, scale)
    // 独立灯架，避免沿用主题的字体、透明度或阴影状态。
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 16
    ctx.fillStyle = 'rgba(12,14,18,0.90)'
    ctx.beginPath()
    ctx.roundRect(-270, -55, 540, 110, 20)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    ctx.stroke()
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 100
      ctx.beginPath()
      ctx.arc(x, 0, 38, 0, Math.PI * 2)
      ctx.fillStyle = '#050609'
      ctx.fill()
      ctx.strokeStyle = '#37383e'
      ctx.stroke()
      const lit = i < state.lit
      const glow = ctx.createRadialGradient(x - 9, -10, 2, x, 0, 31)
      glow.addColorStop(0, lit ? '#ffaaa0' : '#382126')
      glow.addColorStop(.35, lit ? '#ff423c' : '#26161a')
      glow.addColorStop(1, lit ? '#d51025' : '#150d10')
      ctx.beginPath()
      ctx.arc(x, 0, 31, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.shadowColor = '#ff2037'
      ctx.shadowBlur = lit ? 22 : 0
      ctx.fill()
      ctx.shadowBlur = 0
    }
  } finally { ctx.restore() }
}
