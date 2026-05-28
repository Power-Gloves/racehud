import { useEffect, useMemo, useRef, useState } from 'react'
import { LapInfo, Sample } from '../types'

interface Props {
  /** GPS 数据起始绝对时间戳 ms（用于换算 sample，不直接决定 GPS 条在时间轴上的位置）*/
  dataStartT: number
  /** GPS 数据结束绝对时间戳 ms */
  dataEndT: number
  /** 用于在数据轨道上画速度缩略图 */
  samples: Sample[]
  /** GPS 条左端在时间轴上的位置（NLE 序列时间 ms，可被用户拖动）*/
  dataOffsetMs: number
  onDataOffsetChange: (ms: number) => void
  /** 视频条左端在时间轴上的位置（NLE 序列时间 ms，可被用户拖动）*/
  videoOffsetMs: number
  onVideoOffsetChange: (ms: number) => void
  /** 视频时长（秒）*/
  videoDuration: number
  /** Playhead 在时间轴上的位置（NLE 序列时间 ms）*/
  playheadT: number
  onPlayheadChange: (t: number) => void
  /** 当前时刻对应的 sample（顶部读数用）*/
  currentSample: Sample | null
  /** 视频文件名展示用 */
  videoName?: string
  /** 锁定模式：拖任一轨道 → 两条一起平移 / 解锁：每条独立 */
  locked: boolean
  onToggleLock: () => void
  /** 圈数据 */
  laps: LapInfo[]
  /** 跳转到某圈起点 */
  onJumpToLap: (lap: LapInfo | null) => void
}

/**
 * NLE 风格时间轴 ─ Playhead 永远在屏幕中央固定，两条轨道在两侧滚动
 *
 * 核心思想：把"当前时刻"的视觉表达从「playhead 在浮动」改成「内容在两侧滚动」
 *
 * 模型：
 *  - playheadT：当前时刻（序列时间 ms）。固定在屏幕中央
 *  - dataOffsetMs：GPS 条左端在序列时间上的位置（≠ GPS 实际时间，由用户调整对齐）
 *  - videoOffsetMs：视频条左端在序列时间上的位置
 *  - viewSpan：屏幕能看到的时间宽度，由滚轮缩放
 *
 * 拖动行为（往右拖 dx，dt = dx / pxPerMs > 0）：
 *  - 拖标尺 / 空白：scrub。playheadT -= dt（视图整体向右滚动浏览）
 *  - 锁定 + 拖任一轨道：等价于拖标尺。两条 clip 看起来都跟着滚（因为 playhead 中心固定，内容在两侧动）
 *  - 解锁 + 拖 GPS 轨道：dataOffset += dt（GPS 条相对其他东西向右移）
 *  - 解锁 + 拖视频轨道：videoOffset += dt（视频条相对其他东西向右移）
 *
 * Playhead 与数据/视频换算：
 *  - GPS 实际时刻 = dataStartT + (playheadT - dataOffsetMs)
 *  - 视频秒数     = (playheadT - videoOffsetMs) / 1000
 */

const VIEW_SPAN_MIN = 5 * 1000          // 5 秒（最大放大）
const VIEW_SPAN_MAX = 15 * 60 * 1000     // 15 分钟（最大缩小）
const VIEW_SPAN_DEFAULT = 30 * 1000      // 30 秒

export default function Timeline({
  dataStartT, dataEndT, samples,
  dataOffsetMs, onDataOffsetChange,
  videoOffsetMs, onVideoOffsetChange,
  videoDuration,
  playheadT, onPlayheadChange,
  currentSample, videoName,
  locked, onToggleLock,
  laps, onJumpToLap,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)
  const [viewSpan, setViewSpan] = useState(VIEW_SPAN_DEFAULT)

  const dataDuration = dataEndT - dataStartT

  // 边界：playhead 不能拖到所有内容之外
  const fullStart = Math.min(dataOffsetMs, videoOffsetMs)
  const fullEnd = Math.max(dataOffsetMs + dataDuration, videoOffsetMs + videoDuration * 1000)

  // 视图：playhead 始终在屏幕中央
  const visibleStart = playheadT - viewSpan / 2
  const pxPerMs = containerW > 0 ? containerW / viewSpan : 1
  const tToX = (t: number) => (t - visibleStart) * pxPerMs

  // 容器尺寸监听
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // 拖动状态
  const [drag, setDrag] = useState<DragState | null>(null)

  function startDrag(e: React.MouseEvent, target: DragTarget) {
    e.preventDefault()
    e.stopPropagation()
    setDrag({
      target,
      startX: e.clientX,
      startPlayhead: playheadT,
      startVideoOffset: videoOffsetMs,
      startDataOffset: dataOffsetMs,
    })
  }

  useEffect(() => {
    if (!drag) return
    function onMove(e: MouseEvent) {
      if (!drag) return
      const dx = e.clientX - drag.startX
      const dt = dx / pxPerMs
      switch (drag.target) {
        case 'ruler': {
          // 拖标尺：scrub —— playhead 跟随鼠标当前位置
          // 用户在 ruler 上 mousedown 时已经把 playhead 跳到点击位置，
          // 拖动时延续：基于起点 playhead + dt（dt 与拖动方向同向）
          // 但因为 playhead 在屏幕中央固定，"内容向右滚 dx" 等价于 playheadT 减 dt
          onPlayheadChange(clamp(drag.startPlayhead - dt, fullStart, fullEnd))
          break
        }
        case 'data': {
          if (locked) {
            // 锁定：等价于拖标尺，两条 clip 一起跟着滚
            onPlayheadChange(clamp(drag.startPlayhead - dt, fullStart, fullEnd))
          } else {
            // 解锁：只 GPS 条单独移动
            onDataOffsetChange(drag.startDataOffset + dt)
          }
          break
        }
        case 'video': {
          if (locked) {
            onPlayheadChange(clamp(drag.startPlayhead - dt, fullStart, fullEnd))
          } else {
            onVideoOffsetChange(drag.startVideoOffset + dt)
          }
          break
        }
      }
    }
    function onUp() { setDrag(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, pxPerMs, fullStart, fullEnd, onPlayheadChange, onVideoOffsetChange, onDataOffsetChange, locked])

  // 滚轮缩放（光标位置不变）
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.18 : 0.85
    setViewSpan(s => clamp(s * factor, VIEW_SPAN_MIN, VIEW_SPAN_MAX))
  }

  // 速度缩略图（在 GPS 条内部画速度曲线）
  const speedThumbnail = useMemo(
    () => buildSpeedThumbnail(samples, 800),
    [samples]
  )

  // 渲染坐标
  const playheadX = containerW / 2
  const dataLeft = tToX(dataOffsetMs)
  const dataRight = tToX(dataOffsetMs + dataDuration)
  const videoLeft = tToX(videoOffsetMs)
  const videoRight = tToX(videoOffsetMs + videoDuration * 1000)

  // 时间标尺：相对时间（mm:ss），相对于 dataOffsetMs（GPS 起点）
  const ticks = useMemo(
    () => buildRelativeTicks(visibleStart - dataOffsetMs, viewSpan),
    [visibleStart, viewSpan, dataOffsetMs]
  )

  const activeLapNum = currentSample?.lapNum ?? null
  const offsetSec = (videoOffsetMs - dataOffsetMs) / 1000

  return (
    <div className="bg-[#1A1A1A] rounded-lg overflow-hidden border border-[#303030]">
      {/* 顶部读数栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#222] border-b border-[#303030]">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-400">视频对齐</span>
          <span className="font-mono text-orange-300" title="视频条相对 GPS 条的偏移（解锁时拖动可调）">
            {offsetSec >= 0 ? '+' : ''}{offsetSec.toFixed(2)} s
          </span>
          <span className="text-slate-400 ml-4">当前</span>
          <span className="font-mono text-cyan-300" title="GPS 实际时刻">
            {formatAbs(dataStartT + (playheadT - dataOffsetMs))}
          </span>
          {currentSample && (
            <>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-200">{currentSample.speed.toFixed(1)} km/h</span>
              {currentSample.lapNum != null && (
                <span className="font-mono text-slate-400">· L{currentSample.lapNum}</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onToggleLock}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
              locked
                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                : 'bg-orange-500 text-white hover:bg-orange-400'
            }`}
            title={locked ? '已锁定 — 点击解锁以单独调整对齐' : '调整对齐中 — 调好后点击锁定'}
          >
            {locked ? <><LockIcon /> 已锁定</> : <><UnlockIcon /> Adjust Sync</>}
          </button>
          <button
            onClick={() => setViewSpan(VIEW_SPAN_DEFAULT)}
            className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600"
            title="重置缩放"
          >
            {(viewSpan / 1000).toFixed(0)}s
          </button>
        </div>
      </div>

      {/* 时间轴主体 */}
      <div
        ref={containerRef}
        onWheel={onWheel}
        className="relative select-none"
        style={{ height: 152 }}
      >
        {containerW > 0 && (
          <>
            {/* 标尺 — 点击 / 拖动 = scrub playhead */}
            <div
              className="absolute top-0 left-0 right-0 h-7 bg-[#181818] cursor-ew-resize"
              onMouseDown={(e) => {
                // 点标尺直接跳到该时间
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const targetT = clamp(visibleStart + x / pxPerMs, fullStart, fullEnd)
                onPlayheadChange(targetT)
                // 接下去再支持继续拖
                setDrag({
                  target: 'ruler',
                  startX: e.clientX,
                  startPlayhead: targetT,
                  startVideoOffset: videoOffsetMs,
                  startDataOffset: dataOffsetMs,
                })
                e.preventDefault()
              }}
            >
              {ticks.map((tick) => (
                <div
                  key={tick.t}
                  className="absolute top-0 h-full"
                  style={{ left: tToX(tick.t + dataOffsetMs) }}
                >
                  <div className="absolute top-3 h-2 w-px bg-slate-500" />
                  <span className="absolute top-0.5 left-1 text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    {tick.label}
                  </span>
                </div>
              ))}
            </div>

            {/* 数据轨道 */}
            <Track
              y={36}
              label="GPS"
              left={dataLeft}
              right={dataRight}
              color="bg-orange-500/15"
              border="border-orange-500/40"
              labelColor="text-orange-300"
              dragging={drag?.target === 'data'}
              onMouseDown={(e) => startDrag(e, 'data')}
            >
              <SpeedThumbnail
                points={speedThumbnail}
                clipStartT={dataOffsetMs}
                clipEndT={dataOffsetMs + dataDuration}
                tToX={tToX}
              />
            </Track>

            {/* 视频轨道 */}
            {videoDuration > 0 && (
              <Track
                y={88}
                label={videoName ? `🎬 ${truncate(videoName, 30)}` : '视频'}
                left={videoLeft}
                right={videoRight}
                color={locked ? 'bg-cyan-500/15' : 'bg-cyan-500/30'}
                border={locked ? 'border-cyan-500/40' : 'border-cyan-400'}
                labelColor="text-cyan-300"
                dragging={drag?.target === 'video'}
                onMouseDown={(e) => startDrag(e, 'video')}
              />
            )}

            {/* 中央 Playhead — 永远固定在屏幕中央 */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: playheadX - 1, width: 2 }}
            >
              <div className="absolute inset-0 bg-cyan-300/90" />
            </div>
            {/* Playhead 顶部高亮块（在标尺位置） */}
            <div
              className="absolute pointer-events-none rounded-sm bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]"
              style={{ left: playheadX - 14, top: 4, width: 28, height: 18 }}
            />
          </>
        )}
      </div>

      {/* 圈分段条（最底下） */}
      {laps.length > 0 && (
        <LapChips
          laps={laps}
          activeLapNum={activeLapNum}
          onJumpToLap={onJumpToLap}
        />
      )}

      {/* 底部提示 */}
      <div className="px-3 py-1.5 text-[11px] text-slate-500 bg-[#181818] border-t border-[#303030] flex items-center justify-between">
        <span>
          {locked
            ? <>🔒 拖任一处 → 滚动浏览（视频与数据保持同步）</>
            : <>🔓 拖 <span className="text-orange-300">GPS</span> 或 <span className="text-cyan-300">视频</span> 轨道 → 调整对齐 → 调好后点「锁定」</>
          }
          {' '}· 滚轮缩放 · 点击标尺跳转
        </span>
      </div>
    </div>
  )
}

/* ============== 子组件 ============== */

interface TrackProps {
  y: number
  label: string
  left: number
  right: number
  color: string
  border: string
  labelColor: string
  dragging?: boolean
  onMouseDown: (e: React.MouseEvent) => void
  children?: React.ReactNode
}

function Track({ y, label, left, right, color, border, labelColor, dragging, onMouseDown, children }: TrackProps) {
  const width = Math.max(0, right - left)
  return (
    <div
      className={`absolute h-12 rounded border ${color} ${border} overflow-hidden ${
        dragging ? 'cursor-grabbing ring-2 ring-cyan-400' : 'cursor-grab hover:ring-1 hover:ring-cyan-500/60'
      }`}
      style={{ top: y, left, width }}
      onMouseDown={onMouseDown}
    >
      <span className={`absolute left-2 top-1 text-[10px] font-semibold ${labelColor} pointer-events-none uppercase tracking-wider`}>
        {label}
      </span>
      {children}
    </div>
  )
}

function SpeedThumbnail({ points, clipStartT, clipEndT, tToX }: {
  points: { t: number; v: number }[]
  clipStartT: number
  clipEndT: number
  tToX: (t: number) => number
}) {
  if (points.length < 2) return null
  // points 的 t 是 GPS 实际时间，需要映射到 clip 的视图时间（=clipStartT + 数据相对位置）
  // 简化：假设 points[0].t 对应 clipStartT（数据从 clip 左端开始）
  const dataT0 = points[0].t
  const dataT1 = points[points.length - 1].t
  const dataSpan = dataT1 - dataT0 || 1
  const xLeft = tToX(clipStartT)
  const xRight = tToX(clipEndT)
  const widthPx = xRight - xLeft
  const maxV = Math.max(...points.map(p => p.v), 1)
  const path = points.map((p, i) => {
    const ratio = (p.t - dataT0) / dataSpan
    const x = ratio * widthPx
    const y = 44 - (p.v / maxV) * 36
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none">
      <path d={path} fill="none" stroke="#fb923c" strokeWidth={1.2} opacity={0.85} />
    </svg>
  )
}

/** 圈分段：All Laps + 每一圈带 delta 徽章 */
function LapChips({ laps, activeLapNum, onJumpToLap }: {
  laps: LapInfo[]
  activeLapNum: number | null
  onJumpToLap: (lap: LapInfo | null) => void
}) {
  const validLaps = laps.filter(l => l.lapNum > 0)
  const bestLap = validLaps.find(l => l.isBest)

  return (
    <div className="flex items-stretch gap-2 px-2 py-2 overflow-x-auto bg-[#1A1A1A] border-t border-[#303030]">
      <button
        onClick={() => onJumpToLap(null)}
        className={`shrink-0 flex flex-col items-center justify-center min-w-[80px] px-3 py-1.5 rounded text-xs font-bold transition ${
          activeLapNum === null || activeLapNum === 0
            ? 'bg-blue-600 text-white'
            : 'bg-[#2A2A2A] text-slate-300 hover:bg-[#333]'
        }`}
      >
        <span className="text-base leading-none">All Laps</span>
        <span className="font-mono text-[10px] opacity-80 mt-0.5">
          {validLaps.length > 0
            ? formatLap(validLaps.reduce((s, l) => s + l.lapTime, 0))
            : '--'}
        </span>
      </button>
      {validLaps.map(lap => {
        const isActive = lap.lapNum === activeLapNum
        const delta = bestLap && !lap.isBest ? lap.lapTime - bestLap.lapTime : 0
        return (
          <button
            key={lap.lapNum}
            onClick={() => onJumpToLap(lap)}
            className={`shrink-0 relative flex flex-col items-center justify-center min-w-[72px] px-3 py-1.5 rounded text-xs transition leading-tight ${
              isActive
                ? 'bg-blue-600 text-white'
                : lap.isBest
                  ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/40'
                  : 'bg-[#2A2A2A] text-slate-300 hover:bg-[#333]'
            }`}
            title={`第 ${lap.lapNum} 圈 · ${formatLap(lap.lapTime)}${lap.isBest ? ' · 最佳' : ''}`}
          >
            {/* 顶部 delta 徽章 */}
            {lap.isBest && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
                BEST
              </span>
            )}
            {!lap.isBest && delta > 0 && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                +{delta.toFixed(2)}
              </span>
            )}
            <span className="font-bold text-sm">Lap{lap.lapNum}</span>
            <span className="font-mono text-[10px] opacity-80 mt-0.5">{formatLap(lap.lapTime)}</span>
          </button>
        )
      })}
    </div>
  )
}

function formatLap(s: number): string {
  if (!s || s <= 0) return '--:--'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function UnlockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}

/* ============== 工具 ============== */

type DragTarget = 'video' | 'data' | 'ruler'

interface DragState {
  target: DragTarget
  startX: number
  startPlayhead: number
  startVideoOffset: number
  startDataOffset: number
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function formatAbs(t: number): string {
  if (!Number.isFinite(t)) return '--:--:--.---'
  const d = new Date(t)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

/** 缩略图：把 samples 降采样到 ~bucket 个点 */
function buildSpeedThumbnail(samples: Sample[], bucketCount: number): { t: number; v: number }[] {
  if (samples.length === 0 || bucketCount <= 0) return []
  const step = Math.max(1, Math.floor(samples.length / bucketCount))
  const out: { t: number; v: number }[] = []
  for (let i = 0; i < samples.length; i += step) {
    out.push({ t: samples[i].t, v: samples[i].speed })
  }
  return out
}

/**
 * 生成相对时间刻度
 * relStart：visibleStart 相对于 dataOffsetMs（=GPS 起点）的偏移 ms
 * span：viewSpan ms
 * 返回的刻度 t 是相对时间 ms（>= 0 时表示 GPS 起点之后的时间，< 0 之前）
 * 标签格式 mm:ss
 */
function buildRelativeTicks(relStart: number, span: number): { t: number; label: string }[] {
  const targetCount = 10
  const candidates = [100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000, 120000, 300000]
  const ideal = span / targetCount
  const interval = candidates.find(c => c >= ideal) || candidates[candidates.length - 1]
  const relEnd = relStart + span
  const first = Math.ceil(relStart / interval) * interval
  const ticks: { t: number; label: string }[] = []
  for (let t = first; t <= relEnd; t += interval) {
    ticks.push({ t, label: formatRelative(t, interval) })
  }
  return ticks
}

function formatRelative(ms: number, interval: number): string {
  const sign = ms < 0 ? '-' : ''
  const abs = Math.abs(ms)
  const totalSec = Math.floor(abs / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (interval >= 1000) {
    return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  const sec = (abs / 1000).toFixed(1)
  return `${sign}${sec}s`
}
