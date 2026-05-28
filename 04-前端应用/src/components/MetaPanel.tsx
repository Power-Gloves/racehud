import { VboMeta } from '../types'

interface Props {
  meta: VboMeta
  compact?: boolean
}

export default function MetaPanel({ meta, compact }: Props) {
  const start = new Date(meta.startTime).toLocaleString('zh-CN', { hour12: false })
  const end = new Date(meta.endTime).toLocaleString('zh-CN', { hour12: false })
  const minutes = (meta.duration / 60000).toFixed(2)

  const items: [string, string][] = [
    ['来源', `${meta.source} (${meta.model})`],
    ['采样率', `${meta.sampleRate} Hz`],
    ['采样点数', meta.count.toLocaleString()],
    ['起始时间', start],
    ['结束时间', end],
    ['时长', `${minutes} 分钟`],
  ]

  if (compact) {
    return (
      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 space-y-1.5">
        <div className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">数据元信息</div>
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <span className="text-slate-400">{k}</span>
            <span className="font-mono text-slate-200 text-right truncate">{v}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(([k, v]) => (
        <div key={k} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">{k}</div>
          <div className="text-sm font-mono">{v}</div>
        </div>
      ))}
    </div>
  )
}
