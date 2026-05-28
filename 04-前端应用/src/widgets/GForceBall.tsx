import type { WidgetProps } from './index'

/**
 * G-Force 球：圆形仪表，中心十字，当前 G 在 (gLat, gLong) 位置
 */
export default function GForceBall({ ctx }: WidgetProps) {
  const gLat = ctx.current?.gLat ?? 0
  const gLong = ctx.current?.gLong ?? 0
  const total = Math.sqrt(gLat * gLat + gLong * gLong)
  const range = 2
  const x = clamp(gLat / range, -1, 1)
  const y = -clamp(gLong / range, -1, 1)

  return (
    <div className="hud-card flex flex-col items-stretch p-1.5">
      <div className="hud-label px-1">G</div>
      <div className="flex-1 relative">
        <svg viewBox="-1.1 -1.1 2.2 2.2" className="absolute inset-0 w-full h-full">
          {[0.33, 0.66, 1].map((r, i) => (
            <circle key={i} cx="0" cy="0" r={r} fill="none" stroke="var(--hud-border)" strokeWidth="0.012" opacity="0.6" />
          ))}
          <line x1="-1" y1="0" x2="1" y2="0" stroke="var(--hud-border)" strokeWidth="0.012" opacity="0.4" />
          <line x1="0" y1="-1" x2="0" y2="1" stroke="var(--hud-border)" strokeWidth="0.012" opacity="0.4" />
          <circle cx={x} cy={y} r="0.10" fill="var(--hud-accent)" />
          <circle cx={x} cy={y} r="0.16" fill="none" stroke="var(--hud-accent)" strokeWidth="0.025" opacity="0.4" />
        </svg>
        <div
          className="absolute bottom-0.5 right-1 hud-value text-[0.7rem] tabular-nums"
        >
          {total.toFixed(2)}G
        </div>
      </div>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
