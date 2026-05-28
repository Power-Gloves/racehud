import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Sample } from '../types'

interface Props {
  samples: Sample[]
  /** 当前 playhead 对应的绝对时间戳 ms（视频驱动）*/
  cursorT?: number | null
}

export default function SpeedChart({ samples, cursorT }: Props) {
  // 数据降采样到 ~600 点，避免渲染卡顿
  const { data, t0 } = useMemo(() => {
    const t0 = samples[0].t
    const step = Math.max(1, Math.floor(samples.length / 600))
    const arr: { t: number; speed: number }[] = []
    for (let i = 0; i < samples.length; i += step) {
      const s = samples[i]
      arr.push({ t: +((s.t - t0) / 1000).toFixed(1), speed: +s.speed.toFixed(1) })
    }
    return { data: arr, t0 }
  }, [samples])

  const cursorRel = cursorT != null ? (cursorT - t0) / 1000 : null

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ left: -10 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
        <XAxis dataKey="t" stroke="#94a3b8" fontSize={11} unit="s" />
        <YAxis stroke="#94a3b8" fontSize={11} unit=" km/h" />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}
          labelFormatter={(v) => `${v}s`}
        />
        <Line type="monotone" dataKey="speed" stroke="#fb923c" strokeWidth={1.5} dot={false} />
        {cursorRel != null && (
          <ReferenceLine x={cursorRel} stroke="#22d3ee" strokeWidth={1.5} ifOverflow="extendDomain" />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
