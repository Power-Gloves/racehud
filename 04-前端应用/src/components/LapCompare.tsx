import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Sample } from '../types'
import { interpolateSampleAt } from '../hooks/useLaps'
import { compareTimeAt, type ComparableLap } from '../telemetry/lapCompare'

interface Props {
  videoUrl: string
  laps: ComparableLap[]
  unit: 'kph' | 'mph'
  onClose: () => void
}

const COLORS = ['#64d8ff', '#ffb278'] as const

export default function LapCompare({ videoUrl, laps, unit, onClose }: Props) {
  const [firstNum, setFirstNum] = useState(laps[0]?.lap.lapNum)
  const [secondNum, setSecondNum] = useState(laps[1]?.lap.lapNum)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playError, setPlayError] = useState('')
  const videos = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)]
  const elapsedRef = useRef(0)
  const clockStartRef = useRef(0)
  const first = laps.find(l => l.lap.lapNum === firstNum) ?? laps[0]
  const second = laps.find(l => l.lap.lapNum === secondNum) ?? laps.find(l => l !== first)
  const pair = useMemo(() => first && second ? [first, second] as const : null, [first, second])
  const maxTime = pair ? Math.max(...pair.map(l => l.lap.lapTime)) : 0

  useEffect(() => {
    setPlaying(false)
    elapsedRef.current = 0
    setElapsed(0)
    setPlayError('')
    if (pair) pair.forEach((lap, index) => {
      const video = videos[index].current
      if (video) { video.pause(); video.currentTime = lap.videoStartSec }
    })
  }, [pair])

  useEffect(() => {
    if (!playing || !pair) return
    let frame = 0
    clockStartRef.current = performance.now() - elapsedRef.current * 1000
    pair.forEach((lap, index) => {
      const video = videos[index].current
      if (!video) return
      video.currentTime = compareTimeAt(lap, elapsedRef.current)
      if (elapsedRef.current < lap.lap.lapTime) {
        void video.play().catch(() => { setPlaying(false); setPlayError('浏览器无法同时播放这两段视频，请暂停后拖动对比。') })
      }
    })
    const tick = () => {
      const next = Math.min(maxTime, (performance.now() - clockStartRef.current) / 1000)
      elapsedRef.current = next
      setElapsed(next)
      pair.forEach((lap, index) => {
        const video = videos[index].current
        if (!video) return
        const target = compareTimeAt(lap, next)
        if (next >= lap.lap.lapTime) video.pause()
        if (Math.abs(video.currentTime - target) > .18) video.currentTime = target
      })
      if (next < maxTime) frame = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      videos.forEach(ref => ref.current?.pause())
    }
  }, [playing, pair, maxTime])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function seek(t: number) {
    const next = Math.max(0, Math.min(maxTime, t))
    elapsedRef.current = next
    setElapsed(next)
    if (playing) clockStartRef.current = performance.now() - next * 1000
    if (pair) pair.forEach((lap, index) => {
      const video = videos[index].current
      if (video) video.currentTime = compareTimeAt(lap, next)
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[#071018] text-[#edf5f8] overflow-y-auto" role="dialog" aria-modal="true" aria-label="双圈对比">
      <div className="mx-auto max-w-[1560px] min-h-screen px-6 py-4 flex flex-col gap-4">
        <header className="flex items-start justify-between gap-5 border-b border-white/15 pb-4">
          <div>
            <div className="text-xs tracking-[.24em] text-cyan-300/80">RACEHUD / LAP ANALYSIS</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">双圈对比</h2>
            <p className="mt-2 text-sm text-slate-400">以各圈冲线为零点同步播放；轨迹在同一比例下叠加。只供查看，不影响当前导出。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">关闭 ×</button>
        </header>
        {pair && <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pair.map((lap, index) => {
              const current = interpolateSampleAt(lap.samples, lap.lap.startT + Math.min(elapsed, lap.lap.lapTime) * 1000)
              return <section key={`${index}-${lap.lap.lapNum}`} className="overflow-hidden rounded-2xl border border-white/10 bg-[#101b24]">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index] }} />
                    <label className="text-sm font-medium">{index === 0 ? 'A 圈' : 'B 圈'}</label>
                    <select value={lap.lap.lapNum} onChange={e => index === 0 ? setFirstNum(+e.target.value) : setSecondNum(+e.target.value)} className="rounded-md border border-white/15 bg-[#1a2b36] px-2 py-1.5 text-sm">
                      {laps.filter(option => option.lap.lapNum !== pair[1 - index].lap.lapNum).map(option => <option key={option.lap.lapNum} value={option.lap.lapNum}>第 {option.lap.lapNum} 圈</option>)}
                    </select>
                  </div>
                  <strong className="font-mono text-xl" style={{ color: COLORS[index] }}>{formatTime(lap.lap.lapTime)}</strong>
                </div>
                <div className="h-[clamp(200px,29vh,330px)] bg-black"><video ref={videos[index]} src={videoUrl} preload="metadata" playsInline muted={index === 1} onLoadedMetadata={e => { e.currentTarget.currentTime = compareTimeAt(lap, elapsedRef.current) }} className="h-full w-full object-contain" /></div>
                <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-300">
                  <span>全程 {(lap.samples[lap.samples.length - 1].distance - lap.samples[0].distance).toFixed(0)} m · 已行驶 {Math.max(0, (current?.distance ?? lap.samples[0].distance) - lap.samples[0].distance).toFixed(0)} m</span>
                  <span>当前 {Math.round((current?.speed ?? 0) * (unit === 'mph' ? 0.621371 : 1))} {unit === 'mph' ? 'mph' : 'km/h'}</span>
                </div>
              </section>
            })}
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#101b24] px-5 py-4">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => { setPlayError(''); setPlaying(v => !v) }} className="min-w-20 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#071018] hover:bg-cyan-200">{playing ? '暂停' : '播放'}</button>
              <span className="min-w-20 font-mono text-sm">{formatTime(elapsed)}</span>
              <input type="range" min="0" max={maxTime} step="0.01" value={elapsed} onChange={e => seek(+e.target.value)} aria-label="对比进度" className="flex-1 accent-cyan-300" />
              <span className="min-w-20 text-right font-mono text-sm text-slate-400">{formatTime(maxTime)}</span>
            </div>
            {playError && <p className="mt-2 text-sm text-amber-300">{playError}</p>}
          </div>
          <RouteCompare pair={pair} elapsed={elapsed} />
        </>}
      </div>
    </div>, document.body,
  )
}

function RouteCompare({ pair, elapsed }: { pair: readonly [ComparableLap, ComparableLap]; elapsed: number }) {
  const map = useMemo(() => {
    const points = pair.flatMap(l => l.samples)
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
    for (const point of points) {
      minLat = Math.min(minLat, point.lat); maxLat = Math.max(maxLat, point.lat)
      minLng = Math.min(minLng, point.lng); maxLng = Math.max(maxLng, point.lng)
    }
    const lat0 = (minLat + maxLat) / 2
    const lng0 = (minLng + maxLng) / 2
    const cos = Math.cos(lat0 * Math.PI / 180)
    const widthMeters = (maxLng - minLng) * 111195 * cos
    const heightMeters = (maxLat - minLat) * 111195
    const rotated = heightMeters > widthMeters * 1.25
    const xy = (s: Sample) => {
      const x = (s.lng - lng0) * 111195 * cos
      const y = -(s.lat - lat0) * 111195
      return rotated ? { x: -y, y: x } : { x, y }
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const point of points) {
      const p = xy(point)
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    }
    const scale = Math.min(1040 / Math.max(1, maxX - minX), 200 / Math.max(1, maxY - minY))
    const project = (s: Sample) => { const p = xy(s); return { x: 600 + (p.x - (minX + maxX) / 2) * scale, y: 120 + (p.y - (minY + maxY) / 2) * scale } }
    return { paths: pair.map(l => l.samples.map((s, i) => { const p = project(s); return `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')), project, rotated }
  }, [pair])
  return <section className="rounded-2xl border border-white/10 bg-[#101b24] px-5 py-5">
    <div className="mb-3 flex items-center justify-between gap-4"><h3 className="text-base font-semibold">行车线叠加</h3><span className="text-xs text-slate-400">蓝色 A 圈 · 橙色 B 圈 · 相同地图比例{map.rotated ? ' · 轨迹已旋转以便对比' : ''} · 路程差 {Math.abs((pair[0].samples[pair[0].samples.length - 1].distance - pair[0].samples[0].distance) - (pair[1].samples[pair[1].samples.length - 1].distance - pair[1].samples[0].distance)).toFixed(0)} m</span></div>
    <svg viewBox="0 0 1200 240" className="h-[clamp(175px,22vh,260px)] w-full rounded-xl bg-[#0a151d]" role="img" aria-label="两圈行车线叠加图">
      <path d={map.paths[0]} fill="none" stroke={COLORS[0]} strokeWidth="3" strokeLinejoin="round" opacity=".85" />
      <path d={map.paths[1]} fill="none" stroke={COLORS[1]} strokeWidth="3" strokeLinejoin="round" opacity=".85" />
      {pair.map((lap, i) => {
        const point = interpolateSampleAt(lap.samples, lap.lap.startT + Math.min(elapsed, lap.lap.lapTime) * 1000)
        if (!point) return null
        const p = map.project(point)
        return <g key={lap.lap.lapNum}><circle cx={p.x} cy={p.y} r="9" fill={COLORS[i]} stroke="#071018" strokeWidth="3" /><text x={p.x + 13} y={p.y - 10} fill={COLORS[i]} fontSize="18" fontWeight="bold">{i ? 'B' : 'A'}</text></g>
      })}
    </svg>
    <p className="mt-3 text-xs text-slate-500">GPS 走线受定位精度影响；两圈圆点按冲线后经过的时间移动，位置不一定同时到达同一弯道。</p>
  </section>
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '--:--.--'
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`
}
