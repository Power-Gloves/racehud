import { useEffect, useMemo, useRef, useState } from 'react'
import { ParsedVbo, Sample, VboMeta, WidgetContext } from './types'
import { VideoFile } from './components/VideoUploader'
import PreviewStage from './components/PreviewStage'
import Timeline from './components/Timeline'
import LibraryPanel from './components/LibraryPanel'
import SettingsPanel, { useDefaultSettings } from './components/SettingsPanel'
import HudOverlay, { DEFAULT_LAYOUT } from './components/HudOverlay'
import { interpolateSampleAt, useLaps } from './hooks/useLaps'
import { DEFAULT_THEME_ID, getTheme } from './themes'
import { autoSync, type AutoSyncResult } from './telemetry'

/** 设计宽固定 1920；设计高根据 viewport 浮动算（让应用永远铺满整个浏览器，不留白不滚动）
 *  scale = innerWidth / 1920，浏览器 zoom 时 scale 同步变，物理大小保持不变 */
const DESIGN_W = 1920

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

  // 自动对齐状态
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // 自动分圈状态（仅 GoPro 等无圈号数据源用；DLAP 自带圈号不走这里）
  // - autoLapPos：起跑线沿轨迹相对位置 0~1。null 表示用算法自动选
  // - finishLine：当前起跑线两端经纬度，给 MiniMap 画线用
  const [autoLapPos, setAutoLapPos] = useState<number | null>(null)
  const [finishLine, setFinishLine] = useState<{ a: { lat: number; lng: number }; b: { lat: number; lng: number } } | null>(null)
  // 自动分圈数据源：保存原始 samples（视频提取出的），调整滑块时重新分圈而无需重新提取视频
  const [autoLapSource, setAutoLapSource] = useState<{
    rawSamples: Sample[]
    meta: VboMeta
  } | null>(null)

  /**
   * 自动对齐：提取视频内嵌加速度，与 GPS 数据加速度互相关求时间偏移，
   * 据此调整 videoOffsetMs（保持 dataOffsetMs 不动）。
   */
  async function handleAutoSync() {
    if (!video || !data) {
      setSyncMsg('需要同时加载视频和数据文件')
      return
    }
    setSyncing(true)
    setSyncMsg('正在智能对齐…')
    try {
      const res: AutoSyncResult | null = await autoSync(
        video.file,
        data.samples,
        (r) => setSyncMsg(`正在解析视频遥测… ${(r * 100).toFixed(0)}%`),
      )
      if (!res) {
        setSyncMsg('该视频不含可识别的内嵌遥测（需 DJI / GoPro），请手动对齐')
        return
      }
      // lagSeconds 含义：data 索引 i 对应 video 索引 i+lag → video 时间 = data 时间 + lag
      // 时间轴换算：视频秒 = (playheadT - videoOffsetMs)/1000；GPS = startTime+(playheadT-dataOffsetMs)
      // 要让 video 比 data 晚 lag 秒：videoOffsetMs = dataOffsetMs - lag*1000
      const newVideoOffset = dataOffsetMs - res.lagSeconds * 1000
      setVideoOffsetMs(newVideoOffset)
      setLocked(true)
      const conf = (res.confidence * 100).toFixed(0)
      if (res.confidence < 0.1) {
        setSyncMsg(`对齐完成但置信度低 (${conf}%)，建议手动微调。偏移 ${res.lagSeconds.toFixed(2)}s`)
      } else {
        setSyncMsg(`✓ 对齐完成（${res.videoTelemetry.model}，置信度 ${conf}%，偏移 ${res.lagSeconds.toFixed(2)}s）`)
      }
    } catch (e: unknown) {
      setSyncMsg(`对齐失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSyncing(false)
    }
  }

  // ====== 缩放适配 ======
  // 按宽度 fit：scale = innerWidth / 1920，应用宽度永远铺满 viewport
  // 设计高度 = innerHeight / scale，让内部 layout 高度刚好填满 viewport
  // 这样既保持 1920 宽度比例（左/中/右 px 严格），又不留白不滚动；zoom 时物理大小不变
  const [scale, setScale] = useState(1)
  const [designHeight, setDesignHeight] = useState(1080)
  useEffect(() => {
    const update = () => {
      const s = window.innerWidth / DESIGN_W
      setScale(s)
      setDesignHeight(window.innerHeight / s)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

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

  // rAF 循环：视频播放时按浏览器帧率（60fps）拉 video.currentTime
  // 替代 onTimeUpdate（只 4-15Hz），让 HUD 数字按视频帧率平滑更新
  useEffect(() => {
    if (!video) return
    let rafId = 0
    const tick = () => {
      const v = videoRef.current
      if (v && !v.paused && !v.ended) {
        // 直接 set，React 会跳过相同值的 render
        setVideoCurrentTime(v.currentTime)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [video])

  // 用户拖 playhead → 反向跳转视频
  function onPlayheadChange(t: number) {
    setPlayheadT(t)
    if (videoRef.current && videoMeta) {
      const target = (t - videoOffsetMs) / 1000
      const clamped = Math.max(0, Math.min(videoMeta.duration, target))
      if (Math.abs(videoRef.current.currentTime - clamped) > 0.05) {
        videoRef.current.currentTime = clamped
        // 立即同步 videoCurrentTime，避免 seek 异步期间状态回拉、HUD 数字延迟一拍
        setVideoCurrentTime(clamped)
      }
    }
  }

  // 当前 playhead 对应的"GPS 实际时刻"（用 dataStartT 作基准）
  const gpsTimeAtPlayhead = useMemo(() => {
    if (!data) return 0
    return data.meta.startTime + (playheadT - dataOffsetMs)
  }, [data, playheadT, dataOffsetMs])

  const currentSample = useMemo(
    () => data ? interpolateSampleAt(data.samples, gpsTimeAtPlayhead) : null,
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
      finishLine: finishLine ?? undefined,
    }
  }, [data, currentSample, gpsTimeAtPlayhead, laps, bestLap, currentLap, finishLine])

  /**
   * 应用自动分圈：基于原始 samples + 当前 autoLapPos 重新分圈。
   * 输出 ParsedVbo（含 lapNum/lapTimeInLap）+ 终点线坐标，灌进 data/finishLine。
   */
  async function reapplyAutoLap(rawSamples: Sample[], meta: VboMeta, position: number | null) {
    const { autoDetectLaps } = await import('./telemetry/autoLap')
    // 注意 autoDetectLaps 会原地改 sample 的 lapNum/lapTimeInLap，
    // 重算时先深拷贝一层，避免历史污染（lapNum 残留）
    const samples: Sample[] = rawSamples.map(s => ({ ...s, lapNum: undefined, lapTimeInLap: undefined }))
    const lapInfo = autoDetectLaps(samples, { trackPosition: position ?? null })
    setData({ meta, samples })
    setFinishLine(lapInfo.finishLine)
    return lapInfo
  }

  // 当用户拖动滑块改变 autoLapPos 时，重新分圈
  useEffect(() => {
    if (!autoLapSource) return
    reapplyAutoLap(autoLapSource.rawSamples, autoLapSource.meta, autoLapPos).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLapPos, autoLapSource])

  // 选择视频：建 blob URL +（若无外部数据）探测视频内嵌 GPS 遥测当数据源
  async function handleVideoChosen(v: VideoFile) {
    setVideo(v)
    setVideoMeta(null)
    setVideoCurrentTime(0)

    // 若已有外部 DLAP/VBO 数据，不覆盖
    if (data) return

    // 探测视频内嵌遥测
    try {
      setSyncMsg('正在检测视频内嵌遥测…')
      const { extractVideoTelemetry } = await import('./telemetry')
      const vt = await extractVideoTelemetry(v.file, (r) =>
        setSyncMsg(`正在解析视频遥测… ${(r * 100).toFixed(0)}%`))
      if (vt?.hasGps && vt.samples && vt.samples.length > 1) {
        // 视频自带 GPS → 组装 + 自动分圈（场景3）
        const samples = vt.samples as unknown as Sample[]
        const meta: VboMeta = {
          startTime: samples[0].t,
          endTime: samples[samples.length - 1].t,
          duration: samples[samples.length - 1].t - samples[0].t,
          model: vt.model,
          source: 'gopro',
          columns: ['lat', 'lng', 'speed', 'altitude', 'heading'],
          sampleRate: Math.round((samples.length - 1) / Math.max(1, (samples[samples.length - 1].t - samples[0].t) / 1000)),
          count: samples.length,
        }
        // 保存原始 samples 用于后续重新分圈
        setAutoLapSource({ rawSamples: samples, meta })
        setAutoLapPos(null) // 用算法自动选位置
        const lapInfo = await reapplyAutoLap(samples, meta, null)
        const lapMsg = lapInfo.lapCount > 0 ? `，自动分出 ${lapInfo.lapCount} 圈（可在右栏微调起跑线）` : ''
        setSyncMsg(`✓ 已从 ${vt.model} 提取内嵌 GPS（${samples.length} 点）${lapMsg}`)
      } else if (vt && !vt.hasGps) {
        setSyncMsg(`${vt.model} 内嵌加速度已就绪，上传 GPS 数据后可点「智能对齐」`)
      } else {
        setSyncMsg(null)
      }
    } catch {
      setSyncMsg(null)
    }
  }

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
        const url = URL.createObjectURL(file)
        await handleVideoChosen({ file, url, name: file.name, size: file.size })
      }
    }
  }

  return (
    <div
      className="fixed inset-0 bg-bg overflow-hidden"
      onDragEnter={(e) => { e.preventDefault(); setDragHover(true) }}
      onDragOver={(e) => { e.preventDefault() }}
      onDragLeave={(e) => { e.preventDefault(); setDragHover(false) }}
      onDrop={handleDrop}
    >
      {/* 设计稿：宽 1920 固定 / 高浮动；transform scale 从左上角缩放，渲染后 = viewport 大小 */}
      <div
        style={{
          width: DESIGN_W,
          height: designHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <section className="h-full w-full overflow-hidden bg-bg text-white flex flex-col">
          {/* 顶部条 */}
          <header className="h-11 flex items-center px-4 border-b border-[#303030] shrink-0">
            <h1 className="text-base font-bold text-orange-400">racehud</h1>
            <span className="text-[11px] text-gray-66 ml-3">赛车视频 HUD 叠加工具</span>
            {syncMsg && <span className="ml-4 text-cyan-300 text-xs">{syncMsg}</span>}
            {error && <span className="ml-auto text-red-400 text-xs">{error}</span>}
          </header>

          {/* 主内容：三栏 + 底部时间轴。设计稿固定宽度下铺满 */}
          <div className="flex-1 flex flex-col gap-3 p-3 min-h-0">
            {/* 三栏：加宽左右栏、压窄中间，减少视频左右黑边 */}
            <div className="grid gap-3 min-h-0 flex-1 grid-cols-[440px_1fr_460px]">
              {/* 左：媒体与数据 */}
              <div className="min-w-0 min-h-0">
                <LibraryPanel
                  data={data}
                  video={video}
                  onParsed={setData}
                  onError={setError}
                  onChooseVideo={(v) => {
                    if (v) handleVideoChosen(v)
                    else {
                      setVideo(null); setVideoMeta(null); setVideoCurrentTime(0)
                      // 清视频也清自动分圈源（视频是数据来源）
                      if (autoLapSource) {
                        setAutoLapSource(null); setAutoLapPos(null); setFinishLine(null); setData(null)
                      }
                    }
                  }}
                  onClearData={() => {
                    setData(null)
                    setAutoLapSource(null)
                    setAutoLapPos(null)
                    setFinishLine(null)
                  }}
                />
              </div>

              {/* 中：预览舞台 */}
              <div className="min-w-0 min-h-0">
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

              {/* 右：设置 */}
              <div className="min-w-0 min-h-0">
                <SettingsPanel
                  settings={settings}
                  onChange={setSettings}
                  onExport={() => alert('导出功能后续实现')}
                  exportEnabled={!!data && !!video}
                  themeId={themeId}
                  onThemeChange={setThemeId}
                  autoLapEnabled={!!autoLapSource}
                  autoLapPos={autoLapPos}
                  onAutoLapPosChange={setAutoLapPos}
                />
              </div>
            </div>

            {/* 底部时间轴：固定 280px 高度，给圈数 tag 留足空间 */}
            <div className="shrink-0 h-[280px]">
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
                  onAutoSync={handleAutoSync}
                  syncing={syncing}
                  onJumpToLap={(lap) => {
                    if (lap) {
                      // 跳到该圈起点稍后一点（圈内 2% 或 +300ms，取大者），
                      // 确保 currentSample 稳稳落在本圈内，标签立即高亮，不用点两次
                      const lapDurMs = lap.endT - lap.startT
                      const intoLap = Math.max(300, lapDurMs * 0.02)
                      const gpsTarget = lap.startT + intoLap
                      const targetT = gpsTarget - data.meta.startTime + dataOffsetMs
                      onPlayheadChange(targetT)
                    } else {
                      onPlayheadChange(dataOffsetMs)
                    }
                  }}
                />
              ) : (
                <div className="bg-black-18 rounded-lg h-full flex items-center justify-center text-gray-66 text-sm border border-[#404243]">
                  上传 VBO / DLAP 文件后在此显示时间轴
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* 拖拽遮罩 */}
      {dragHover && (
        <div className="absolute inset-0 bg-orange-500/10 border-4 border-dashed border-orange-400 pointer-events-none flex items-center justify-center z-50">
          <div className="text-2xl text-orange-300 font-bold">放手以导入文件</div>
        </div>
      )}
    </div>
  )
}
