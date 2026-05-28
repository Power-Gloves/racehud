import { useState } from 'react'
import { ParsedVbo } from '../types'

interface Props {
  onParsed: (data: ParsedVbo) => void
  onError: (msg: string) => void
}

export default function VboUploader({ onParsed, onError }: Props) {
  const [loading, setLoading] = useState(false)
  const [filename, setFilename] = useState<string>('')

  async function handleFile(file: File) {
    setLoading(true)
    setFilename(file.name)
    onError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/parse-telemetry', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data: ParsedVbo = await res.json()
      onParsed(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      onError(`解析失败：${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="inline-flex items-center gap-3 cursor-pointer bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-lg border border-slate-700">
        <input
          type="file"
          accept=".vbo,.dlap,text/plain,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <span className="text-sm">
          {loading ? '解析中...' : '选择 VBO / DLAP 文件上传'}
        </span>
      </label>
      {filename && !loading && (
        <span className="text-xs text-slate-400 truncate max-w-md" title={filename}>
          {filename}
        </span>
      )}
    </div>
  )
}
