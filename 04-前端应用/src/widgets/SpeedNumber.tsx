import type { WidgetProps } from './index'

export default function SpeedNumber({ ctx }: WidgetProps) {
  const speed = ctx.current?.speed ?? 0
  return (
    <div className="hud-card flex flex-col justify-center">
      <div className="hud-label">Speed</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="hud-value text-[2.2rem]">
          {speed.toFixed(0)}
        </span>
        <span className="hud-unit">km/h</span>
      </div>
    </div>
  )
}
