import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { analysisAt, type AnalysisPoint, type LapAnalysis } from '../telemetry/lapAnalysis'

interface Props {
  analysis: LapAnalysis
  cursor: AnalysisPoint | null
  unit: 'kph' | 'mph'
  onSeekDistance: (distance: number) => void
}

export default function LapComparisonChart({ analysis, cursor, unit, onSeekDistance }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const [range, setRange] = useState<[number, number]>([0, analysis.lengthA])
  useEffect(() => { setRange([0, analysis.lengthA]); setHover(null) }, [analysis])
  const factor = unit === 'mph' ? .621371 : 1
  const label = unit === 'mph' ? 'mph' : 'km/h'
  const value = hover === null ? cursor : analysisAt(analysis, hover)
  const span = Math.max(1, range[1] - range[0])
  const x = (distance: number) => 58 + (distance - range[0]) / span * 914
  const graph = useMemo(() => {
    const points = analysis.points.filter(p => p.distance >= range[0] && p.distance <= range[1])
    const start = analysisAt(analysis, range[0]), end = analysisAt(analysis, range[1])
    if (start) points.unshift(start)
    if (end) points.push(end)
    let maxSpeed = 20, maxDelta = .2
    for (const p of points) {
      maxSpeed = Math.max(maxSpeed, p.speedA * factor, p.speedB * factor)
      maxDelta = Math.max(maxDelta, Math.abs(p.delta))
    }
    maxSpeed = Math.ceil(maxSpeed / 20) * 20
    maxDelta = Math.ceil(maxDelta * 5) / 5
    const sx = (p: AnalysisPoint) => 58 + (p.distance - range[0]) / Math.max(1, range[1] - range[0]) * 914
    const sy = (speed: number) => 134 - speed * factor / maxSpeed * 104
    const dy = (delta: number) => 216 - delta / maxDelta * 44
    const speedPath = (key: 'speedA' | 'speedB') => points.map((p, i) => `${i ? 'L' : 'M'}${sx(p).toFixed(2)},${sy(p[key]).toFixed(2)}`).join(' ')
    let positive = '', negative = ''
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i]
      const part = (px: number, py: number, qx: number, qy: number) => `M${px},${py}L${qx},${qy}`
      if ((a.delta >= 0) === (b.delta >= 0)) {
        if (b.delta >= 0) positive += part(sx(a), dy(a.delta), sx(b), dy(b.delta))
        else negative += part(sx(a), dy(a.delta), sx(b), dy(b.delta))
      } else {
        const crossing = sx(a) + (sx(b) - sx(a)) * (-a.delta / (b.delta - a.delta))
        const before = part(sx(a), dy(a.delta), crossing, 216)
        const after = part(crossing, 216, sx(b), dy(b.delta))
        positive += a.delta >= 0 ? before : after
        negative += a.delta < 0 ? before : after
      }
    }
    return { a: speedPath('speedA'), b: speedPath('speedB'), positive, negative, maxSpeed, maxDelta, sy, dy }
  }, [analysis, range, factor])

  function distanceFrom(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const coordinate = (event.clientX - box.left - 8) / Math.max(1, box.width - 16) * 1000
    return Math.max(range[0], Math.min(range[1], range[0] + (coordinate - 58) / 914 * span))
  }
  function zoom(multiplier: number) {
    const width = Math.min(analysis.lengthA, Math.max(analysis.lengthA / 16, span * multiplier))
    const center = Math.max(range[0], Math.min(range[1], value?.distance ?? (range[0] + range[1]) / 2))
    const start = Math.max(0, Math.min(analysis.lengthA - width, center - width / 2))
    setRange([start, start + width])
  }
  const crossX = value ? x(value.distance) : -1
  const visible = value && crossX >= 58 && crossX <= 972
  return <section className="compare-panel min-w-0" aria-label="速度与秒差分析">
    <div className="compare-panel-head">
      <h3>速度 / 时间差</h3>
      <div className="flex items-center gap-1">
        <button type="button" className="compare-small-button" onClick={() => zoom(.5)} aria-label="放大当前分析区段" title="放大当前分析区段">＋</button>
        <button type="button" className="compare-small-button" onClick={() => zoom(2)} aria-label="缩小分析区段" title="缩小分析区段">－</button>
        <button type="button" className="compare-small-button" onClick={() => setRange([0, analysis.lengthA])}>全圈</button>
      </div>
    </div>
    <div className="compare-readings">
      <span><i className="compare-dot" style={{ background: '#59b5ff' }} /> A <b>{value ? (value.speedA * factor).toFixed(1) : '—'}</b> {label}</span>
      <span><i className="compare-dot" style={{ background: '#fb923c' }} /> B <b>{value ? (value.speedB * factor).toFixed(1) : '—'}</b> {label}</span>
      <span>Δ速度 <b>{value ? signed((value.speedB - value.speedA) * factor, 1) : '—'}</b> {label}</span>
      <span>Δ时间 <b style={{ color: value && value.delta > 0 ? '#f87171' : '#6ee7b7' }}>{value ? signed(value.delta, 3) : '—'} s</b></span>
    </div>
    {analysis.points.length ? <>
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="compare-chart" tabIndex={0} role="group" aria-label="速度与秒差图表"
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); const d = distanceFrom(event); setHover(d); onSeekDistance(d) }}
        onPointerMove={event => { const d = distanceFrom(event); setHover(d); if (event.currentTarget.hasPointerCapture(event.pointerId)) onSeekDistance(d) }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const d = Math.max(range[0], Math.min(range[1], (value?.distance ?? range[0]) + span / 100 * (event.key === 'ArrowRight' ? 1 : -1))); setHover(d); onSeekDistance(d) } }}>
        <rect x="58" y="24" width="914" height="116" fill="#181818" />
        <rect x="58" y="168" width="914" height="96" fill="#181818" />
        {[0, 1, 2, 3, 4, 5].map(i => <g key={i}>
          <line x1={58 + i / 5 * 914} x2={58 + i / 5 * 914} y1="24" y2="264" stroke="#383838" strokeDasharray="3 5" />
          <text x={58 + i / 5 * 914} y="285" textAnchor="middle" fill="#999" fontSize="11">{Math.round(range[0] + i / 5 * span)} m</text>
        </g>)}
        {[0, .5, 1].map(f => <g key={f}>
          <line x1="58" x2="972" y1={134 - f * 104} y2={134 - f * 104} stroke="#383838" />
          <text x="48" y={138 - f * 104} textAnchor="end" fill="#999" fontSize="11">{Math.round(f * graph.maxSpeed)}</text>
        </g>)}
        <text x="58" y="15" fill="#aaa" fontSize="11">速度 ({label})</text>
        <text x="58" y="158" fill="#aaa" fontSize="11">Δ时间 (s) · B − A</text>
        <line x1="58" x2="972" y1="216" y2="216" stroke="#888" strokeDasharray="5 4" />
        {[-1, 0, 1].map(f => <text key={f} x="48" y={220 - f * 44} textAnchor="end" fill="#999" fontSize="11">{signed(f * graph.maxDelta, 1)}</text>)}
        <path d={graph.a} fill="none" stroke="#59b5ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={graph.b} fill="none" stroke="#fb923c" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={graph.positive} fill="none" stroke="#f87171" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={graph.negative} fill="none" stroke="#6ee7b7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {visible && value && <g>
          <line x1={crossX} x2={crossX} y1="24" y2="264" stroke="#eee" strokeWidth="1" />
          <circle cx={crossX} cy={graph.sy(value.speedA)} r="4" fill="#59b5ff" stroke="#181818" />
          <circle cx={crossX} cy={graph.sy(value.speedB)} r="4" fill="#fb923c" stroke="#181818" />
          <circle cx={crossX} cy={graph.dy(value.delta)} r="4" fill={value.delta >= 0 ? '#f87171' : '#6ee7b7'} />
        </g>}
      </svg>
      <div className="compare-chart-caption"><span>A 圈参考距离 · 悬停查看，点击／拖动定位视频</span><span>红色 + B 慢 · 绿色 − B 快</span></div>
      <div className="compare-chart-times">{value ? `位置 ${value.distance.toFixed(0)} m · A 用时 ${value.timeA.toFixed(3)} s · B 用时 ${value.timeB.toFixed(3)} s` : '选择曲线上的位置查看数据'} · {analysis.alignment === 'position' ? 'GPS 位置对齐' : '距离比例估算'}</div>
    </> : <p className="p-5 text-sm text-amber-300">{analysis.warning}</p>}
  </section>
}

export function signed(value: number, digits: number) {
  const rounded = Number(value.toFixed(digits))
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`
}
