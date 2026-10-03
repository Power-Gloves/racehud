import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Sample } from '../types'
import { interpolateSampleAt } from '../hooks/useLaps'
import { compareTimeAt, type ComparableLap } from '../telemetry/lapCompare'
import { analysisAt, buildLapAnalysis } from '../telemetry/lapAnalysis'
import LapComparisonChart, { signed } from './LapComparisonChart'
import './lapCompare.css'

interface Props {
  videoUrl: string
  laps: ComparableLap[]
  unit: 'kph' | 'mph'
  onClose: () => void
}

const COLORS = ['#59b5ff', '#fb923c'] as const

export default function LapCompare({ videoUrl, laps, unit, onClose }: Props) {
  const [firstNum, setFirstNum] = useState(laps[0]?.lap.lapNum)
  const [secondNum, setSecondNum] = useState(laps[1]?.lap.lapNum)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playError, setPlayError] = useState('')
  const [mode, setMode] = useState<'time' | 'position'>('position')
  const videos = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)]
  const elapsedRef = useRef(0)
  const clockStartRef = useRef(0)
  const first = laps.find(l => l.lap.lapNum === firstNum) ?? laps[0]
  const second = laps.find(l => l.lap.lapNum === secondNum) ?? laps.find(l => l !== first)
  const pair = useMemo(() => first && second ? [first, second] as const : null, [first, second])
  const analysis = useMemo(() => pair ? buildLapAnalysis(pair[0], pair[1]) : null, [pair])
  const positionMode = mode === 'position' && !!analysis?.points.length
  const maxTime = pair ? positionMode ? pair[0].lap.lapTime : Math.max(...pair.map(l => l.lap.lapTime)) : 0
  const cursor = analysis ? analysisAt(analysis, elapsed, 'timeA') : null
  const times = [elapsed, positionMode ? cursor?.timeB ?? elapsed : elapsed] as const

  function timesAt(t: number, selectedMode = mode) {
    return [t, selectedMode === 'position' && analysis?.points.length ? analysisAt(analysis, t, 'timeA')?.timeB ?? t : t]
  }

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
    const pending = [false, false]
    function resume(index: number) {
      const video = videos[index].current
      if (!video || pending[index] || !video.paused) return
      pending[index] = true
      void video.play().catch(() => { setPlaying(false); setPlayError('浏览器无法同时播放这两段视频，请暂停后拖动对比。') }).finally(() => { pending[index] = false })
    }
    clockStartRef.current = performance.now() - elapsedRef.current * 1000
    pair.forEach((lap, index) => {
      const video = videos[index].current
      if (!video) return
      const t = timesAt(elapsedRef.current)[index]
      video.currentTime = compareTimeAt(lap, t)
      if (t < lap.lap.lapTime) resume(index)
    })
    const tick = () => {
      const next = Math.min(maxTime, (performance.now() - clockStartRef.current) / 1000)
      elapsedRef.current = next
      setElapsed(next)
      const localTimes = timesAt(next)
      pair.forEach((lap, index) => {
        const video = videos[index].current
        if (!video) return
        const target = compareTimeAt(lap, localTimes[index])
        if (index === 1 && positionMode && analysis) {
          const before = analysisAt(analysis, Math.max(0, next - .15), 'timeA')
          const after = analysisAt(analysis, Math.min(maxTime, next + .15), 'timeA')
          const rate = before && after && after.timeA > before.timeA ? (after.timeB - before.timeB) / (after.timeA - before.timeA) : 1
          video.playbackRate = Math.max(.25, Math.min(3, rate))
        } else video.playbackRate = 1
        if (localTimes[index] >= lap.lap.lapTime) video.pause()
        else resume(index)
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
  }, [playing, pair, maxTime, positionMode, analysis])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function seek(t: number, selectedMode = mode) {
    const limit = pair ? selectedMode === 'position' && analysis?.points.length ? pair[0].lap.lapTime : Math.max(...pair.map(l => l.lap.lapTime)) : 0
    const next = Math.max(0, Math.min(limit, t))
    elapsedRef.current = next
    setElapsed(next)
    if (playing) clockStartRef.current = performance.now() - next * 1000
    if (pair) pair.forEach((lap, index) => {
      const video = videos[index].current
      if (video) video.currentTime = compareTimeAt(lap, timesAt(next, selectedMode)[index])
    })
  }

  return createPortal(
    <div className="lap-compare" role="dialog" aria-modal="true" aria-label="双圈对比">
      <div className="compare-workspace">
        <header className="compare-header">
          <div>
            <h2><span>racehud</span> 双圈对比</h2>
            <p>A 为参考圈 · 蓝色 A / 橙色 B · 速度和秒差按对应赛道位置分析</p>
          </div>
          <button type="button" onClick={onClose} className="compare-small-button">返回主界面 ×</button>
        </header>
        {pair && <>
          <div className="compare-summary"><span>A 参考圈 · 第 {pair[0].lap.lapNum} 圈</span><span>B 对比圈 · 第 {pair[1].lap.lapNum} 圈</span><span>整圈 Δ <strong style={{ color: pair[1].lap.lapTime > pair[0].lap.lapTime ? '#f87171' : '#6ee7b7' }}>{signed(pair[1].lap.lapTime - pair[0].lap.lapTime, 3)} s</strong></span></div>
          <div className="compare-videos">
            {pair.map((lap, index) => {
              const current = interpolateSampleAt(lap.samples, lap.lap.startT + Math.min(times[index], lap.lap.lapTime) * 1000)
              return <section key={`${index}-${lap.lap.lapNum}`} className="compare-panel compare-video-panel">
                <div className="compare-panel-head">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index] }} />
                    <label className="text-sm font-medium">{index === 0 ? 'A 圈' : 'B 圈'}</label>
                    <select aria-label={index === 0 ? '参考 A 圈' : '对比 B 圈'} value={lap.lap.lapNum} onChange={e => index === 0 ? setFirstNum(+e.target.value) : setSecondNum(+e.target.value)} className="compare-select">
                      {laps.filter(option => option.lap.lapNum !== pair[1 - index].lap.lapNum).map(option => <option key={option.lap.lapNum} value={option.lap.lapNum}>第 {option.lap.lapNum} 圈</option>)}
                    </select>
                  </div>
                  <strong className="font-mono text-lg" style={{ color: COLORS[index] }}>{formatTime(lap.lap.lapTime)}</strong>
                </div>
                <div className="compare-video"><video ref={videos[index]} src={videoUrl} preload="metadata" playsInline muted={index === 1 || positionMode} onLoadedMetadata={e => { e.currentTarget.currentTime = compareTimeAt(lap, timesAt(elapsedRef.current)[index]) }} className="h-full w-full object-contain" /></div>
                <div className="compare-video-readings">
                  <span>全程 {(lap.samples[lap.samples.length - 1].distance - lap.samples[0].distance).toFixed(0)} m · 已行驶 {Math.max(0, (current?.distance ?? lap.samples[0].distance) - lap.samples[0].distance).toFixed(0)} m</span>
                  <span>当前 {Math.round((current?.speed ?? 0) * (unit === 'mph' ? 0.621371 : 1))} {unit === 'mph' ? 'mph' : 'km/h'}</span>
                  <span>用时 {Math.min(times[index], lap.lap.lapTime).toFixed(2)} s</span>
                </div>
              </section>
            })}
          </div>
          <div className="compare-controls">
            <div className="compare-control-row">
              <button type="button" onClick={() => { setPlayError(''); if (!playing && elapsedRef.current >= maxTime) seek(0); setPlaying(v => !v) }} className="compare-play">{playing ? '暂停' : '播放'}</button>
              <span className="min-w-20 font-mono text-sm">{formatTime(elapsed)}</span>
              <input type="range" min="0" max={maxTime} step="any" value={elapsed} onChange={e => seek(+e.target.value)} aria-label="对比进度" className="flex-1 accent-orange-400" />
              <span className="min-w-20 text-right font-mono text-sm text-slate-400">{formatTime(maxTime)}</span>
              <div className="compare-mode" aria-label="回放对齐方式">
                {(['position', 'time'] as const).map(option => <button key={option} type="button" disabled={option === 'position' && !analysis?.points.length} aria-pressed={mode === option} onClick={() => { setPlaying(false); setMode(option); seek(elapsedRef.current, option) }}>{option === 'position' ? '同位置分析' : '同时间回放'}</button>)}
              </div>
            </div>
            {playError && <p className="mt-2 text-sm text-amber-300">{playError}</p>}
            {analysis?.warning && <p className="mt-2 text-xs text-amber-300">{analysis.warning}</p>}
          </div>
          <div className="compare-analysis-grid">
            <RouteCompare pair={pair} times={times} />
            {analysis && <LapComparisonChart analysis={analysis} cursor={cursor} unit={unit} onSeekDistance={distance => { const point = analysisAt(analysis, distance); if (point) { setPlaying(false); setMode('position'); seek(point.timeA, 'position') } }} />}
          </div>
          <p className="compare-note">{positionMode ? '同位置分析会调整 B 视频的播放节奏以匹配 A 圈位置；两路静音。' : '同时间回放按各圈冲线后经过时间播放，快慢圈会出现在不同位置。'} GPS 对齐为估算；图表 Δ时间 = B 用时 − A 用时，终点为两圈完整圈时差。</p>
        </>}
      </div>
    </div>, document.body,
  )
}

function RouteCompare({ pair, times }: { pair: readonly [ComparableLap, ComparableLap]; times: readonly [number, number] }) {
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
    const rotated = widthMeters > heightMeters * 1.4
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
    const scale = Math.min(310 / Math.max(1, maxX - minX), 260 / Math.max(1, maxY - minY))
    const project = (s: Sample) => { const p = xy(s); return { x: 180 + (p.x - (minX + maxX) / 2) * scale, y: 155 + (p.y - (minY + maxY) / 2) * scale } }
    return { paths: pair.map(l => l.samples.map((s, i) => { const p = project(s); return `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')), project, rotated }
  }, [pair])
  return <section className="compare-panel compare-map-panel">
    <div className="compare-panel-head"><h3>行车线对比</h3><span className="text-xs text-gray-400">同一比例</span></div>
    <svg viewBox="0 0 360 310" className="compare-map" role="img" aria-label="两圈行车线叠加图">
      <path d={map.paths[0]} fill="none" stroke={COLORS[0]} strokeWidth="3" strokeLinejoin="round" opacity=".85" />
      <path d={map.paths[1]} fill="none" stroke={COLORS[1]} strokeWidth="3" strokeLinejoin="round" opacity=".85" />
      {pair.map((lap, i) => {
        const point = interpolateSampleAt(lap.samples, lap.lap.startT + Math.min(times[i], lap.lap.lapTime) * 1000)
        if (!point) return null
        const p = map.project(point)
        return <g key={lap.lap.lapNum}><circle cx={p.x} cy={p.y} r="6" fill={COLORS[i]} stroke="#181818" strokeWidth="2" /><text x={p.x + 8} y={p.y - 8} fill={COLORS[i]} fontSize="13" fontWeight="bold">{i ? 'B' : 'A'}</text></g>
      })}
    </svg>
    <div className="compare-map-caption">路程差 {Math.abs((pair[0].samples[pair[0].samples.length - 1].distance - pair[0].samples[0].distance) - (pair[1].samples[pair[1].samples.length - 1].distance - pair[1].samples[0].distance)).toFixed(1)} m{map.rotated ? ' · 轨迹共同旋转' : ''}</div>
  </section>
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '--:--.--'
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`
}
