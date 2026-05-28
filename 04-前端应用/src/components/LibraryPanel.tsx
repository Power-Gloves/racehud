import { useRef } from 'react'
import { ParsedVbo } from '../types'
import { VideoFile } from './VideoUploader'

interface Props {
  data: ParsedVbo | null
  video: VideoFile | null
  onParsed: (d: ParsedVbo) => void
  onError: (msg: string) => void
  onChooseVideo: (v: VideoFile | null) => void
  onClearData: () => void
}

/**
 * 左栏：Media & Data Library
 *
 * 1:1 复刻 dragy laptimer 的 iN 组件结构（className 直接对齐）：
 *   外层 (GM) → header (KM/qM) → 说明文案 → Data Library 行 (JM) → Video 行 (QM)
 *
 * 行内布局：
 *   Data Library: 单行卡（h-12 长条），有文件时显示文件名 + 删除，无文件时显示 + 加号
 *   Video:        横向滚动卡片网格（h-22 w-32.5），第一张是 Import 卡，后续是已导入视频
 */
export default function LibraryPanel({ data, video, onParsed, onError, onChooseVideo, onClearData }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  /** 一次接受任意类型，按扩展名分发到 telemetry parser 或 video URL */
  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase().split('.').pop() || ''
      if (ext === 'vbo' || ext === 'dlap') {
        await uploadTelemetry(file)
      } else if (file.type.startsWith('video/') || ext === 'mp4' || ext === 'mov') {
        chooseVideo(file)
      }
    }
  }

  async function uploadTelemetry(file: File) {
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/parse-telemetry', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      onParsed(await res.json())
      onError('')
    } catch (e: unknown) {
      onError(`解析失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function chooseVideo(file: File) {
    const url = URL.createObjectURL(file)
    onChooseVideo({ file, url, name: file.name, size: file.size })
  }

  function clearVideo(e: React.MouseEvent) {
    e.stopPropagation()
    if (video?.url) URL.revokeObjectURL(video.url)
    onChooseVideo(null)
  }

  function clearData(e: React.MouseEvent) {
    e.stopPropagation()
    onClearData()
  }

  // 数据文件名（VBO / DLAP）
  const dataFileName = data ? buildDataLabel(data) : ''
  const videoExt = video?.name.split('.').pop()?.toUpperCase() ?? ''

  return (
    <aside className="flex flex-auto flex-col gap-y-3 h-full">
      {/* 隐藏的 input — 通过 ref 触发 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vbo,.dlap,.mp4,.mov,video/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept=".mp4,.mov,video/*"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />

      {/* 主面板 */}
      <div className="bg-bg flex-auto overflow-hidden rounded-lg border-2 border-[#404243] px-5 pt-4 pb-5 text-white flex flex-col">
        {/* Header */}
        <div className="flex-bc w-full">
          <div className="flex-cc gap-x-3">
            <FolderIcon className="h-6.5 w-6.5" />
            <span className="capitalize font-medium">media &amp; data library</span>
          </div>
        </div>

        {/* 说明文案 */}
        <div className="text-gray-66 flex gap-x-3 border-b border-[#303232] pt-1 pb-4 text-[0.6875rem]">
          <i className="w-6.5 shrink-0" />
          <span className="min-w-0 flex-1 leading-relaxed">
            选择同一段比赛的视频文件（MP4 / MOV）和数据文件（.dlap / .vbo）。
          </span>
        </div>

        {/* Data Library 行 */}
        <div className="flex items-center gap-x-4 pt-4 text-sm font-medium">
          <span className="text-nowrap text-gray-66 capitalize">data library</span>
          <div
            onClick={() => fileInputRef.current?.click()}
            title={dataFileName}
            className="bg-black-18 text-gray-66 flex-bc relative h-12 flex-auto cursor-pointer gap-x-3 overflow-hidden px-4 rounded hover:bg-[#1f1f1f] transition"
          >
            {dataFileName ? (
              <>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-white">
                  {dataFileName}
                </span>
                <CloseIcon onClick={clearData} className="h-5.5 w-5.5 cursor-pointer text-gray-66 hover:text-white shrink-0" />
              </>
            ) : (
              <div className="flex-cc absolute inset-1/2 h-6 w-6 -translate-1/2">
                <div className="h-0.75 w-6 rounded-xs bg-[#313131]" />
                <div className="absolute inset-1/2 h-0.75 w-6 -translate-1/2 rotate-90 rounded-xs bg-[#313131]" />
              </div>
            )}
          </div>
        </div>

        {/* Video 行 */}
        <div className="flex items-start gap-x-4 overflow-hidden pt-4 text-sm">
          <span className="flex flex-col text-nowrap pt-2">
            <span className="text-center text-gray-66 capitalize">video</span>
            <span className="invisible text-center">data library</span>
          </span>
          <div className="h-full w-full flex-auto overflow-x-auto overflow-y-hidden scroll-smooth">
            <ul className="flex h-full flex-nowrap gap-x-5">
              {/* Import 卡 */}
              <li
                onClick={() => videoInputRef.current?.click()}
                className="bg-black-18 flex h-22 w-32.5 shrink-0 cursor-pointer flex-col items-center justify-center rounded hover:bg-[#1f1f1f] transition"
              >
                <div className="flex-cc relative aspect-square h-10.5 w-10.5 rounded-full bg-[#313131]">
                  <div className="bg-black-18 h-0.75 w-6.5 flex-none rounded-xs" />
                  <div className="bg-black-18 absolute left-1/2 h-0.75 w-6.5 -translate-x-1/2 rotate-90 rounded-xs" />
                </div>
                <span className="text-gray-66 pt-1 text-[0.8125rem] capitalize">import</span>
              </li>

              {/* 已选视频卡 */}
              {video && (
                <li
                  className="bg-black-18 relative h-22 w-32.5 flex-none cursor-pointer overflow-hidden rounded"
                  title={video.name}
                >
                  <video
                    src={video.url}
                    className="h-full w-full object-cover"
                    preload="metadata"
                    muted
                  />
                  <CloseIcon
                    onClick={clearVideo}
                    className="absolute top-1 left-1 h-4 w-4 cursor-pointer text-white drop-shadow z-10"
                  />
                  <span className="pointer-events-none absolute top-1 right-1 text-[0.8125rem] font-bold text-white/75">
                    {videoExt}
                  </span>
                  <span className="pointer-events-none absolute bottom-0 left-0 block w-full overflow-hidden bg-black/50 px-1 py-0.5 text-[0.5625rem] text-ellipsis text-white/75 whitespace-nowrap">
                    {video.name}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  )
}

/** 数据文件标签：拼出 "deviceModel · 13.06min · 7839pts" 形式 */
function buildDataLabel(data: ParsedVbo): string {
  const dur = (data.meta.duration / 60000).toFixed(2)
  return `${data.meta.model} · ${dur} min · ${data.samples.length.toLocaleString()} pts`
}

/* ============ Icons ============ */

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 26" width="26" height="26" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

function CloseIcon({ className, onClick }: { className?: string; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <svg viewBox="0 0 22 22" width="22" height="22" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" onClick={onClick}>
      <circle cx="11" cy="11" r="9" />
      <path d="M7.5 7.5l7 7M14.5 7.5l-7 7" />
    </svg>
  )
}
