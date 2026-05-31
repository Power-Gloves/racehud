import type { WidgetProps } from './index'

/**
 * LAP n  · CUR 0:27.35  · BEST ▲1.81
 */
export default function LapInfo({ ctx }: WidgetProps) {
  const cur = ctx.current
  const lapNum = cur?.lapNum ?? 0
  const lapTimeMs = cur?.lapTimeInLap ?? 0
  const bestCompare = cur?.bestCompare ?? 0

  return (
    <div className="hud-card flex items-center gap-3">
      <Field label="Lap" value={String(lapNum)} />
      <Field label="Cur" value={formatLap(lapTimeMs)} />
      <Field
        label="vs Best"
        value={formatDelta(bestCompare)}
        className={bestCompare < 0 ? 'hud-good' : bestCompare > 0 ? 'hud-warn' : ''}
      />
    </div>
  )
}

function Field({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <div className="hud-label">{label}</div>
      <div className={`hud-value text-[2rem] mt-1 ${className}`}>{value}</div>
    </div>
  )
}

function formatLap(ms: number): string {
  if (!ms || ms <= 0) return '0:00.00'
  const total = ms / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

function formatDelta(s: number): string {
  if (!s) return '--'
  const sign = s > 0 ? '+' : '−'
  return `${sign}${Math.abs(s).toFixed(2)}`
}
