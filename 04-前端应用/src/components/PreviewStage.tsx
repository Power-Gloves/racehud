import { forwardRef, ReactNode, useEffect, useRef, useState } from 'react'
import { VideoFile } from './VideoUploader'

export interface VideoMeta {
  duration: number
  width: number
  height: number
}

interface Props {
  video: VideoFile | null
  videoMeta: VideoMeta | null
  currentTime: number
  onTimeUpdate: (t: number) => void
  onLoaded: (m: VideoMeta) => void
  /** HUD 叠加层，永远渲染（包括无视频时） */
  hudOverlay?: ReactNode
  /** 数据是否就绪（用于显示空状态文案） */
  hasData?: boolean
}

/**
 * 中央预览舞台 — 1:1 复刻 dragy laptimer 的 video 预览面板
 *
 * 结构（自上而下）：
 *   1. Header：文件夹图标 + 视频文件名 + 分辨率徽章
 *   2. 视频区：video 元素 + HUD overlay（无视频时仍渲染 HUD）
 *   3. 进度条行：当前时间 / 总时间 + 拖动条
 *   4. 控制条：撤销重做 / Previous Frame / 大播放按钮 / Next Frame / 横屏 / 全屏
 *
 * 所有 className 都从 laptimer.com bundle 中扒出，尺寸保持一致：
 *   外层容器、间距、border、颜色都对齐 dragy 的 #404243 / #181818 / #323232 / #9E9C9C
 */
const PreviewStage = forwardRef<HTMLVideoElement, Props>(
  ({ video, videoMeta, currentTime, onTimeUpdate, onLoaded, hudOverlay, hasData }, ref) => {
    const [playing, setPlaying] = useState(false)
    const [rotation, setRotation] = useState(0)
    const wrapRef = useRef<HTMLDivElement>(null)
    const stageWrapRef = useRef<HTMLDivElement>(null)

    // 视频比例：未加载时用 16:9 占位，加载后用真实比例
    // 旋转 90° 或 270° 时长宽互换
    const swapRatio = rotation === 90 || rotation === 270
    const ratio = videoMeta
      ? (swapRatio ? videoMeta.height / videoMeta.width : videoMeta.width / videoMeta.height)
      : 16 / 9

    // 用 ResizeObserver 算 stage 在父容器内 contain 的实际尺寸
    const [stage, setStage] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
    useEffect(() => {
      const el = stageWrapRef.current
      if (!el) return
      const ro = new ResizeObserver(() => {
        const pw = el.clientWidth
        const ph = el.clientHeight
        if (pw <= 0 || ph <= 0) return
        // 在 (pw, ph) 范围内 contain 一个 ratio 的盒子
        let w = pw
        let h = pw / ratio
        if (h > ph) { h = ph; w = ph * ratio }
        setStage({ w: Math.floor(w), h: Math.floor(h) })
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [ratio])

    // 同步播放状态（视频元素的 onPlay/onPause）
    useEffect(() => {
      const v = (ref as React.RefObject<HTMLVideoElement>).current
      if (!v) return
      const onPlay = () => setPlaying(true)
      const onPause = () => setPlaying(false)
      v.addEventListener('play', onPlay)
      v.addEventListener('pause', onPause)
      return () => {
        v.removeEventListener('play', onPlay)
        v.removeEventListener('pause', onPause)
      }
    }, [video, ref])

    function getVideo() {
      return (ref as React.RefObject<HTMLVideoElement>).current
    }

    function togglePlay() {
      const v = getVideo()
      if (!v) return
      if (v.paused) v.play()
      else v.pause()
    }

    function stepFrame(dir: 1 | -1) {
      const v = getVideo()
      if (!v) return
      v.pause()
      // 假设 30fps（后续可从视频元数据探测真实帧率）
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + dir * (1 / 30)))
    }

    function rotate() {
      setRotation((r) => (r + 90) % 360)
    }

    function fullscreen() {
      const el = wrapRef.current
      if (!el) return
      if (document.fullscreenElement) document.exitFullscreen()
      else el.requestFullscreen?.()
    }

    function onProgressMouseDown(e: React.MouseEvent<HTMLDivElement>) {
      const v = getVideo()
      const dur = v?.duration || videoMeta?.duration || 0
      if (!dur) return
      const track = e.currentTarget
      const seek = (clientX: number) => {
        const rect = track.getBoundingClientRect()
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
        if (v) v.currentTime = dur * ratio
        else onTimeUpdate(dur * ratio)
      }
      seek(e.clientX)
      const move = (ev: MouseEvent) => seek(ev.clientX)
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }

    const duration = videoMeta?.duration ?? 0
    const progress = duration > 0 ? clamp(currentTime / duration, 0, 1) : 0

    // 分辨率徽章
    const resBadge = videoMeta ? `${videoMeta.width} × ${videoMeta.height}` : null
    const filename = video?.name ?? (hasData ? '数据预览模式' : '未选择视频')

    return (
      <div
        ref={wrapRef}
        className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border-2 border-[#404243] text-base text-white bg-[#1A1A1A]"
      >
        {/* 1. Header */}
        <div className="flex w-full items-center justify-between px-5 pt-4 pb-1.5 shrink-0">
          <div className="flex w-full items-center gap-x-3 min-w-0">
            <FolderIcon className="h-[26px] w-[26px] shrink-0 text-white" />
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {filename}
            </span>
            {resBadge && (
              <span className="flex-none rounded border border-dashed border-[#404243] bg-[#181818] px-3 py-0.5 text-xs font-light">
                {resBadge}
              </span>
            )}
          </div>
        </div>

        {/* 2. 视频 + HUD overlay 区。
            关键：stage 内部按视频原生分辨率（如 1920×1080）固定渲染，
            外层 transform scale 缩到当前显示大小。这样 widget 在所有显示尺寸下
            视觉比例严格一致——预览效果 = 全屏效果 = 导出效果（WYSIWYG）。 */}
        <div
          ref={stageWrapRef}
          className="flex-auto overflow-hidden min-h-0 flex items-center justify-center p-3"
        >
          <div
            className="relative bg-black shadow-lg"
            style={{
              width: stage.w || 'auto',
              height: stage.h || 'auto',
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
              transition: 'transform 300ms',
            }}
          >
            {/* 内部画布：固定 1920 宽（跟视频真实分辨率脱钩），所有 widget 在 1920 坐标系里画。
                视频元素 absolute fill 自适应；这样 1080p / 4K 视频 HUD 视觉一致。 */}
            {(() => {
              const INNER_W = 1920
              const innerH = ratio > 0 ? INNER_W / ratio : 1080
              const displayScale = stage.w > 0 ? stage.w / INNER_W : 0
              return (
                <div
                  style={{
                    width: INNER_W,
                    height: innerH,
                    transform: `scale(${displayScale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  {video && (
                    <video
                      ref={ref}
                      src={video.url}
                      className="absolute inset-0 w-full h-full"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget
                        onLoaded({ duration: v.duration, width: v.videoWidth, height: v.videoHeight })
                      }}
                      onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
                      onClick={togglePlay}
                    />
                  )}
                  {/* HUD overlay 在 1920 坐标系里按 placement 百分比定位 */}
                  {hudOverlay}
                </div>
              )
            })()}

            {!video && !hasData && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-66 gap-2">
                <div className="text-3xl">⊕</div>
                <div className="text-sm">选择视频或数据文件</div>
              </div>
            )}
            {!video && hasData && (
              <div className="absolute top-2 right-2 z-10 text-[10px] text-white/70 bg-black/50 backdrop-blur-sm px-2 py-1 rounded uppercase tracking-wider border border-white/10">
                数据预览模式
              </div>
            )}
          </div>
        </div>

        {/* 3. 进度条 */}
        <div className="flex items-center gap-x-3 px-4 pt-3 shrink-0">
          <div className="flex items-center gap-x-1 text-sm text-white font-mono tabular-nums shrink-0">
            <span>{formatVideoTime(currentTime)}</span>
            <span className="text-[#9E9C9C]">/</span>
            <span className="text-[#9E9C9C]">{formatVideoTime(duration)}</span>
          </div>
          <div
            className={`relative h-1.5 flex-auto rounded-full bg-[#323232] ${
              video ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
            }`}
            style={{
              background: `linear-gradient(90deg, #747378 ${progress * 100}%, #323232 ${progress * 100}%)`,
            }}
            onMouseDown={video ? onProgressMouseDown : undefined}
          >
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* 4. 控制条 */}
        <div className="relative flex items-center justify-between px-4 pt-2 pb-3 shrink-0">
          {/* 左：撤销 / 重做（先 disabled） */}
          <div className="flex gap-2">
            <button disabled className="cursor-not-allowed disabled:opacity-30" title="撤销">
              <UndoIcon className="h-[34px] w-[34px]" />
            </button>
            <button disabled className="cursor-not-allowed disabled:opacity-30" title="重做">
              <UndoIcon className="h-[34px] w-[34px] scale-x-[-1]" />
            </button>
          </div>

          {/* 中：上一帧 / 大播放 / 下一帧 */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => stepFrame(-1)}
              disabled={!video}
              className="cursor-pointer text-xs uppercase tracking-wider text-[#9E9C9C] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous Frame
            </button>
            <button
              onClick={togglePlay}
              disabled={!video}
              className="cursor-pointer outline-0 disabled:cursor-not-allowed disabled:opacity-50 hover:scale-105 transition"
            >
              {playing ? (
                <PauseIcon className="h-[60px] w-[60px]" />
              ) : (
                <PlayIcon className="h-[60px] w-[60px]" />
              )}
            </button>
            <button
              onClick={() => stepFrame(1)}
              disabled={!video}
              className="cursor-pointer text-xs uppercase tracking-wider text-[#9E9C9C] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next Frame
            </button>
          </div>

          {/* 右：横屏切换 / 全屏 */}
          <div className="flex gap-x-6">
            <button
              onClick={rotate}
              disabled={!video}
              className="cursor-pointer disabled:opacity-50"
              title="旋转 90°"
            >
              <RotateIcon className="h-[28px] w-[35px]" />
            </button>
            <button
              onClick={fullscreen}
              disabled={!video}
              className="cursor-pointer disabled:opacity-50"
              title="全屏"
            >
              <FullscreenIcon className="h-[32px] w-[32px]" />
            </button>
          </div>
        </div>
      </div>
    )
  }
)
PreviewStage.displayName = 'PreviewStage'
export default PreviewStage

/* ============== 工具函数 ============== */

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function formatVideoTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '00:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/* ============== Icons (内嵌 SVG，参考 dragy 风格但简化) ============== */

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 26" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} fill="currentColor">
      <path d="M22 16 L46 30 L22 44 Z" />
    </svg>
  )
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} fill="currentColor">
      <rect x="20" y="16" width="6" height="28" rx="1" />
      <rect x="34" y="16" width="6" height="28" rx="1" />
    </svg>
  )
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14h13a6 6 0 0 1 0 12h-7" />
      <path d="M9 14l5-5M9 14l5 5" />
    </svg>
  )
}

function RotateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 35 28" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="8" width="23" height="12" rx="1" />
      <path d="M3 11a8 8 0 0 1 8-8M32 17a8 8 0 0 1-8 8" />
      <path d="M3 11l-2-2M3 11l2-2M32 17l2 2M32 17l-2 2" />
    </svg>
  )
}

function FullscreenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12V3h9M29 12V3h-9M3 20v9h9M29 20v9h-9" />
    </svg>
  )
}
