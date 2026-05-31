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
 * 左栏：媒体与数据库
 *
 * 极简版：两个文件槽，一行一个。
 *   - 未选：虚线按钮「+ 选择文件」
 *   - 已选：文件名 · 元数据 · 关闭按钮
 */
export default function LibraryPanel({ data, video, onParsed, onError, onChooseVideo, onClearData }: Props) {
  const dataInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

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
    if (video?.url) URL.revokeObjectURL(video.url)
    const url = URL.createObjectURL(file)
    onChooseVideo({ file, url, name: file.name, size: file.size })
  }

  function clearVideo() {
    if (video?.url) URL.revokeObjectURL(video.url)
    onChooseVideo(null)
  }

  return (
    <aside className="flex h-full w-full flex-col">
      {/* 隐藏的 input — 通过 ref 触发 */}
      <input
        ref={dataInputRef}
        type="file"
        accept=".vbo,.dlap"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) uploadTelemetry(f)
          e.target.value = ''
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept=".mp4,.mov,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) chooseVideo(f)
          e.target.value = ''
        }}
      />

      <div className="flex flex-1 w-full flex-col gap-4 rounded-lg border border-[#404243] bg-bg p-4 overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <FolderIcon className="h-5 w-5" />
          <span>媒体与数据</span>
        </div>

        <p className="text-xs leading-relaxed text-gray-66">
          上传同一段比赛的视频（MP4/MOV）和数据文件（.vbo / .dlap）。
        </p>

        <div className="h-px bg-[#303232]" />

        {/* 数据文件槽 */}
        <FileSlot
          label="数据文件"
          accept=".vbo / .dlap"
          name={data ? data.meta.model || '已加载' : ''}
          meta={data ? `${(data.meta.duration / 60000).toFixed(2)} min · ${data.samples.length.toLocaleString()} pts` : ''}
          onChoose={() => dataInputRef.current?.click()}
          onClear={onClearData}
        />

        {/* 视频文件槽 */}
        <FileSlot
          label="视频文件"
          accept="MP4 / MOV"
          name={video?.name ?? ''}
          meta={video ? `${(video.size / 1024 / 1024).toFixed(0)} MB` : ''}
          onChoose={() => videoInputRef.current?.click()}
          onClear={clearVideo}
        />

        {/* 占位区：撑满剩余空间，未来放数据摘要 / 圈数列表 */}
        <div className="mt-2 flex-1" />
      </div>
    </aside>
  )
}

/* ============== FileSlot ============== */

interface FileSlotProps {
  label: string
  accept: string
  name: string
  meta: string
  onChoose: () => void
  onClear: () => void
}

function FileSlot({ label, accept, name, meta, onChoose, onClear }: FileSlotProps) {
  const has = !!name
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">
        <span className="text-gray-66">{label}</span>
        <span className="text-gray-66/70">{accept}</span>
      </div>
      {has ? (
        <div className="flex items-center gap-2 rounded bg-black-18 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white" title={name}>
              {name}
            </div>
            {meta && <div className="truncate text-[11px] text-gray-66 mt-0.5">{meta}</div>}
          </div>
          <button
            onClick={onClear}
            className="text-gray-66 hover:text-white shrink-0 p-1 -mr-1"
            title="移除"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={onChoose}
          className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-[#404243] bg-black-18 px-3 py-3 text-sm text-gray-66 hover:border-orange-400/60 hover:text-orange-300 hover:bg-[#1f1f1f] transition"
        >
          <PlusIcon className="h-4 w-4" />
          <span>选择文件</span>
        </button>
      )}
    </div>
  )
}

/* ============== Icons ============== */

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  )
}
