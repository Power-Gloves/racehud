import { useEffect, useMemo, useRef, useState } from 'react'
import { ParsedVbo, WidgetContext } from './types'
import { VideoFile } from './components/VideoUploader'
import PreviewStage from './components/PreviewStage'
import Timeline from './components/Timeline'
import LibraryPanel from './components/LibraryPanel'
import SettingsPanel, { useDefaultSettings } from './components/SettingsPanel'
import HudOverlay, { DEFAULT_LAYOUT } from './components/HudOverlay'
import { findSampleNear, useLaps } from './hooks/useLaps'
import { DEFAULT_THEME_ID, getTheme } from './themes'

export default function App() {
  const [data, setData] = useState<ParsedVbo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoFile | null>(null)
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [videoOffsetMs, setVideoOffsetMs] = useState<number>(0)
  const [dataOffsetMs, setDataOffsetMs] = useState<number>(0)
  const [playheadT, setPlayheadT] = useState<number>(0)
  const [locked, setLocked] = useState<boolean>(true)
  const [layout] = useState(DEFAULT_LAYOUT)
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID)
  const [settings, setSettings] = useDefaultSettings()

  const theme = useMemo(() => getTheme(themeId), [themeId])

  const [dragHover, setDragHover] = useState(false)

  // 加载新数据时初始化：让 GPS 条和视频条都从同一序列时间起始（重合），
  // playhead 也指向那里
  useEffect(() => {
    if (data) {
      setDataOffsetMs(data.meta.startTime)
      setVideoOffsetMs(data.meta.startTime)
      setPlayheadT(data.meta.startTime)
    }
  }, [data])

  // 视频播放时 → 同步 playhead（视频秒数 = playheadT - videoOffset）
  useEffect(() => {
    if (!video) return
    setPlayheadT(videoOffsetMs + videoCurrentTime * 1000)
  }, [videoCurrentTime, videoOffsetMs, video])

  // 用户拖 playhead → 反向跳转视频
  function onPlayheadChange(t: number) {
    setPlayheadT(t)
    if (videoRef.current && videoMeta) {
      const target = (t - videoOffsetMs) / 1000
      const clamped = Math.max(0, Math.min(videoMeta.duration, target))
      if (Math.abs(videoRef.current.currentTime - clamped) > 0.05) {
        videoRef.current.currentTime = clamped
      }
    }
  }

  // 当前 playhead 对应的"GPS 实际时刻"（用 dataStartT 作基准）
  const gpsTimeAtPlayhead = useMemo(() => {
    if (!data) return 0
    return data.meta.startTime + (playheadT - dataOffsetMs)
  }, [data, playheadT, dataOffsetMs])

  const currentSample = useMemo(
    () => data ? findSampleNear(data.samples, gpsTimeAtPlayhead) : null,
    [data, gpsTimeAtPlayhead]
  )

  const { laps, bestLap, currentLap } = useLaps(data?.samples ?? [], gpsTimeAtPlayhead)

  const widgetCtx: WidgetContext | null = useMemo(() => {
    if (!data) return null
    return {
      current: currentSample,
      samples: data.samples,
      meta: data.meta,
      playheadT: gpsTimeAtPlayhead,  // widget 的"当前时刻"用 GPS 真实时刻
      laps, bestLap, currentLap,
    }
  }, [data, currentSample, gpsTimeAtPlayhead, laps, bestLap, currentLap])

  // 拖拽文件到页面任意位置
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragHover(false)
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop() || ''
      if (ext === 'vbo' || ext === 'dlap') {
        const form = new FormData()
        form.append('file', file)
        try {
          const res = await fetch('/api/parse-telemetry', { method: 'POST', body: form })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || `HTTP ${res.status}`)
          }
          setData(await res.json())
          setError(null)
        } catch (err: unknown) {
          setError(`解析失败：${err instanceof Error ? err.message : String(err)}`)
        }
      } else if (file.type.startsWith('video/') || ext === 'mp4' || ext === 'mov') {
        // 调用 VideoUploader 内部一致的逻辑：建 blob URL
        const url = URL.createObjectURL(file)
        setVideo({ file, url, name: file.name, size: file.size })
        setVideoMeta(null)
        setVideoCurrentTime(0)
      }
    }
  }

  return (
    <section
      className="h-screen w-full overflow-hidden bg-bg text-white flex flex-col"
      onDragEnter={(e) => { e.preventDefault(); setDragHover(true) }}
      onDragOver={(e) => { e.preventDefault() }}
      onDragLeave={(e) => { e.preventDefault(); setDragHover(false) }}
      onDrop={handleDrop}
    >
      {/* 顶部条 */}
      <header className="h-11 flex items-center px-4 border-b border-[#303030] shrink-0">
        <h1 className="text-base font-bold text-orange-400">racehud</h1>
        <span className="text-[11px] text-gray-66 ml-3">赛车视频 HUD 叠加工具</span>
        {error && <span className="ml-auto text-red-400 text-xs">{error}</span>}
      </header>

      {/* 主内容：三栏 + 底部时间轴 */}
      <div className="flex-1 flex flex-col gap-3 p-3 min-h-0">
        {/* 三栏 */}
        <div className="flex gap-3 min-h-0 flex-1">
          {/* 左：Library — 极简，只两行紧凑卡 */}
          <div className="w-64 shrink-0">
            <LibraryPanel
              data={data}
              video={video}
              onParsed={setData}
              onError={setError}
              onChooseVideo={(v) => { setVideo(v); setVideoMeta(null); setVideoCurrentTime(0) }}
              onClearData={() => setData(null)}
            />
          </div>

          {/* 中：预览舞台（1:1 复刻 dragy 视频面板）— HUD 永远渲染，跟视频解耦 */}
          <div className="flex-1 min-w-0">
            <PreviewStage
              ref={videoRef}
              video={video}
              videoMeta={videoMeta}
              currentTime={videoCurrentTime}
              onLoaded={setVideoMeta}
              onTimeUpdate={setVideoCurrentTime}
              hasData={!!data}
              hudOverlay={widgetCtx ? <HudOverlay ctx={widgetCtx} layout={layout} theme={theme} /> : null}
            />
          </div>

          {/* 右：Settings */}
          <div className="w-80 shrink-0">
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              onExport={() => alert('导出功能后续实现')}
              exportEnabled={!!data && !!video}
              themeId={themeId}
              onThemeChange={setThemeId}
            />
          </div>
        </div>

        {/* 底部时间轴 */}
        <div className="shrink-0">
          {data ? (
            <Timeline
              dataStartT={data.meta.startTime}
              dataEndT={data.meta.endTime}
              samples={data.samples}
              dataOffsetMs={dataOffsetMs}
              onDataOffsetChange={setDataOffsetMs}
              videoOffsetMs={videoOffsetMs}
              onVideoOffsetChange={setVideoOffsetMs}
              videoDuration={videoMeta?.duration ?? 0}
              playheadT={playheadT}
              onPlayheadChange={onPlayheadChange}
              currentSample={currentSample}
              videoName={video?.name}
              locked={locked}
              onToggleLock={() => setLocked(v => !v)}
              laps={laps}
              onJumpToLap={(lap) => {
                if (lap) {
                  onPlayheadChange(lap.startT - data.meta.startTime + dataOffsetMs + 50)
                } else {
                  onPlayheadChange(dataOffsetMs)
                }
              }}
            />
          ) : (
            <div className="bg-black-18 rounded-lg h-[170px] flex items-center justify-center text-gray-66 text-sm border border-[#404243]">
              上传 VBO / DLAP 文件后在此显示时间轴
            </div>
          )}
        </div>
      </div>

      {/* 拖拽遮罩 */}
      {dragHover && (
        <div className="absolute inset-0 bg-orange-500/10 border-4 border-dashed border-orange-400 pointer-events-none flex items-center justify-center z-50">
          <div className="text-2xl text-orange-300 font-bold">放手以导入文件</div>
        </div>
      )}
    </section>
  )
}
