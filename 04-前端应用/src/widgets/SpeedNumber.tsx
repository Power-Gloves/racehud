import { useMemo } from 'react'
import type { WidgetProps } from './index'

/**
 * 速度 widget：数字 + 横向 progress bar（颜色按速度区间渐变 绿→黄→红）
 *
 * 简化版本，先实现功能。后续视觉打磨 / 组件化抽象时单独优化。
 */
export default function SpeedNumber({ ctx }: WidgetProps) {
  const speed = ctx.current?.speed ?? 0

  const maxSpeed = useMemo(() => {
    let m = 0
    for (const s of ctx.samples) if (s.speed > m) m = s.speed
    return m > 0 ? m : 200
  }, [ctx.samples])

  const ratio = Math.max(0, Math.min(1, speed / maxSpeed))
  const color = colorAt(ratio)

  return (
    <div className="hud-card flex flex-col justify-center">
      {/* 顶部 label + unit */}
      <div className="flex items-baseline justify-between">
        <span className="hud-label">Speed</span>
        <span className="hud-unit">km/h</span>
      </div>

      {/* 主数字 */}
      <div className="hud-value text-[4rem] leading-none my-2">
        {speed.toFixed(0)}
      </div>

      {/* 速度条 */}
      <div
        className="relative h-2.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255, 255, 255, 0.12)' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${ratio * 100}%`,
            background: color,
            boxShadow: `0 0 10px ${color}, 0 0 4px ${color}`,
            transition: 'width 180ms ease-out, background 180ms',
          }}
        />
      </div>

      {/* 底部刻度 */}
      <div className="flex justify-between mt-1 hud-unit text-[10px]">
        <span>0</span>
        <span>{maxSpeed.toFixed(0)}</span>
      </div>
    </div>
  )
}

/* ============== 颜色插值（绿 → 黄 → 红） ============== */

const COLOR_STOPS: Array<{ at: number; rgb: [number, number, number] }> = [
  { at: 0.00, rgb: [16, 185, 129] },   // 绿  #10b981
  { at: 0.50, rgb: [250, 204, 21] },   // 黄  #facc15
  { at: 1.00, rgb: [239, 68, 68] },    // 红  #ef4444
]

function colorAt(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio))
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    if (r <= COLOR_STOPS[i].at) {
      const a = COLOR_STOPS[i - 1]
      const b = COLOR_STOPS[i]
      const t = (r - a.at) / (b.at - a.at)
      const rgb = a.rgb.map((c, j) => Math.round(c + (b.rgb[j] - c) * t))
      return `rgb(${rgb.join(',')})`
    }
  }
  const last = COLOR_STOPS[COLOR_STOPS.length - 1].rgb
  return `rgb(${last.join(',')})`
}
