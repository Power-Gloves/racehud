import type { WidgetProps } from './index'

/**
 * 历圈榜：列出每一圈用时，标记最佳圈和当前圈
 */
export default function LapList({ ctx }: WidgetProps) {
  const laps = ctx.laps.filter(l => l.lapNum > 0)
  return (
    <div className="hud-card flex flex-col">
      <div className="hud-label mb-1">Laps</div>
      <div className="flex-1 overflow-auto space-y-1 text-[18px]" style={{ fontFamily: 'var(--hud-font-num)' }}>
        {laps.length === 0 && <div className="hud-label opacity-60">—</div>}
        {laps.map(l => {
          const cls = l.isCurrent
            ? 'hud-accent font-bold'
            : l.isBest
              ? 'hud-good font-bold'
              : ''
          return (
            <div key={l.lapNum} className={`flex justify-between tabular-nums ${cls}`}>
              <span>L{l.lapNum}</span>
              <span>{formatLap(l.lapTime)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatLap(s: number): string {
  if (!s || s <= 0) return '--'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`
}
