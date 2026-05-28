import { useRef } from 'react'

export interface VideoFile {
  file: File
  url: string
  name: string
  size: number
}

interface Props {
  current: VideoFile | null
  onChoose: (v: VideoFile | null) => void
}

/**
 * 视频选择器 —— 不上传，直接在浏览器里用 createObjectURL 播放
 * 视频通常 2-4 GB，上传到后端浪费且慢
 */
export default function VideoUploader({ current, onChoose }: Props) {
  const lastUrlRef = useRef<string | null>(null)

  function pick(file: File) {
    // 释放上一个 blob URL，避免内存泄漏
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
    const url = URL.createObjectURL(file)
    lastUrlRef.current = url
    onChoose({ file, url, name: file.name, size: file.size })
  }

  function clear() {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
    lastUrlRef.current = null
    onChoose(null)
  }

  return (
    <div className="flex items-center gap-3">
      <label className="inline-flex items-center gap-3 cursor-pointer bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-lg border border-slate-700">
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
            e.target.value = ''
          }}
        />
        <span className="text-sm">选择视频文件</span>
      </label>
      {current && (
        <>
          <span className="text-xs text-slate-400 truncate max-w-md" title={current.name}>
            {current.name} · {(current.size / 1024 / 1024).toFixed(0)} MB
          </span>
          <button
            onClick={clear}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            清除
          </button>
        </>
      )}
    </div>
  )
}
