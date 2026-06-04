import { useState } from 'react'
import ThemePicker from './ThemePicker'

export interface ExportSettings {
  vehicleType: 'car' | 'motor'
  unit: 'kph' | 'mph'
  resolution: '720p' | '1080p' | '2k' | '4k'
}

interface Props {
  settings: ExportSettings
  onChange: (s: ExportSettings) => void
  onExport: () => void
  exportEnabled?: boolean
  /** 是否正在导出 */
  exporting?: boolean
  /** 导出进度 0~1 */
  exportProgress?: number
  /** 取消导出 */
  onCancelExport?: () => void
  themeId: string
  onThemeChange: (id: string) => void
  /** 自动分圈起跑线位置 0~1（仅自动分圈数据源时启用），null = 算法自动 */
  autoLapPos?: number | null
  onAutoLapPosChange?: (pos: number | null) => void
  /** 自动分圈是否可用（视频含 GPS 时） */
  autoLapEnabled?: boolean
}

/**
 * 右栏：设置 + HUD 主题 + 导出
 */
export default function SettingsPanel({
  settings, onChange, onExport, exportEnabled,
  exporting, exportProgress, onCancelExport,
  themeId, onThemeChange,
  autoLapPos, onAutoLapPosChange, autoLapEnabled,
}: Props) {
  return (
    <div className="bg-bg rounded-lg p-4 flex flex-col gap-4 h-full w-full overflow-y-auto text-sm border border-[#404243]">
      <div className="flex items-center gap-2 text-white font-semibold uppercase tracking-wider text-[13px]">
        <span className="inline-block w-1.5 h-4 bg-primary rounded-sm" />
        设置
      </div>

      {/* HUD 主题 */}
      <Field label="HUD 主题">
        <ThemePicker themeId={themeId} onChange={onThemeChange} />
      </Field>

      <div className="border-t border-[#2a2a2a]" />

      {autoLapEnabled && onAutoLapPosChange && (
        <>
          <Collapsible title="起跑线位置" defaultOpen={false}>
            <div className="space-y-3">
              {/* 滑块 */}
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={Math.round((autoLapPos ?? 0.5) * 1000)}
                  onChange={(e) => onAutoLapPosChange(parseInt(e.target.value, 10) / 1000)}
                  className="flex-1 accent-orange-400"
                />
                <button
                  onClick={() => onAutoLapPosChange(null)}
                  className="text-[10px] px-2 py-1 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-66 hover:text-white shrink-0"
                  title="重置为算法自动选择"
                >
                  Auto
                </button>
              </div>

              {/* 精确调整 */}
              {autoLapPos != null && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => onAutoLapPosChange(Math.max(0, autoLapPos - 0.01))}
                      className="px-2 py-1 text-xs bg-primary hover:opacity-90 text-white rounded"
                      title="向前 1%"
                    >
                      -1%
                    </button>
                    <button
                      onClick={() => onAutoLapPosChange(Math.max(0, autoLapPos - 0.0005))}
                      className="px-2 py-1 text-xs bg-primary/70 hover:opacity-90 text-white rounded"
                      title="向前 0.05%"
                    >
                      -0.05%
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.05}
                    value={Math.round(autoLapPos * 2000) / 20}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) onAutoLapPosChange(Math.max(0, Math.min(1, val / 100)))
                    }}
                    className="w-16 px-2 py-1 text-xs text-center bg-[#2a2a2a] text-white rounded border border-gray-600 focus:border-primary focus:outline-none"
                  />
                  <span className="text-xs text-gray-66">%</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onAutoLapPosChange(Math.min(1, autoLapPos + 0.0005))}
                      className="px-2 py-1 text-xs bg-primary/70 hover:opacity-90 text-white rounded"
                      title="向后 0.05%"
                    >
                      +0.05%
                    </button>
                    <button
                      onClick={() => onAutoLapPosChange(Math.min(1, autoLapPos + 0.01))}
                      className="px-2 py-1 text-xs bg-primary hover:opacity-90 text-white rounded"
                      title="向后 1%"
                    >
                      +1%
                    </button>
                  </div>
                </div>
              )}

              {/* 说明文字 */}
              <div className="text-[10px] text-gray-66">
                {autoLapPos == null 
                  ? '💡 算法自动检测起跑线位置' 
                  : `📍 当前位置: 沿轨迹 ${Math.round(autoLapPos * 100)}%`}
              </div>
            </div>
          </Collapsible>
          <div className="border-t border-[#2a2a2a]" />
        </>
      )}

      <Field label="车型">
        <Segment
          options={[{ value: 'car', label: 'Car' }, { value: 'motor', label: 'Motor' }]}
          value={settings.vehicleType}
          onChange={(v) => onChange({ ...settings, vehicleType: v as ExportSettings['vehicleType'] })}
        />
      </Field>

      <Field label="单位">
        <Segment
          options={[{ value: 'kph', label: 'KPH' }, { value: 'mph', label: 'MPH' }]}
          value={settings.unit}
          onChange={(v) => onChange({ ...settings, unit: v as ExportSettings['unit'] })}
        />
      </Field>

      <Field label="分辨率">
        <Segment
          options={[
            { value: '720p', label: '720p' },
            { value: '1080p', label: '1080p' },
            { value: '2k', label: '2K' },
            { value: '4k', label: '4K' },
          ]}
          value={settings.resolution}
          onChange={(v) => onChange({ ...settings, resolution: v as ExportSettings['resolution'] })}
        />
      </Field>

      <div className="flex-1" />

      {exporting ? (
        <div className="space-y-2">
          {/* 进度条 */}
          <div className="relative h-3 rounded-full bg-black-18 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${(exportProgress ?? 0) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-cyan-300">
              导出中… {((exportProgress ?? 0) * 100).toFixed(1)}%
            </span>
            <button
              onClick={onCancelExport}
              className="px-3 py-1 text-xs rounded bg-[#404243] hover:bg-[#505253] text-white transition"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={onExport}
            disabled={!exportEnabled}
            className="w-full py-3 bg-primary hover:opacity-90 disabled:bg-black-18 disabled:text-gray-66 text-white font-semibold rounded text-base transition uppercase tracking-wider"
          >
            导出带 HUD 的视频
          </button>
          <p className="text-[10px] text-gray-66 text-center -mt-2">
            导出在浏览器本地完成，不上传任何数据
          </p>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-gray-66 mb-1.5 uppercase tracking-wider">{label}</div>
      {children}
    </div>
  )
}

function Collapsible({ title, defaultOpen = false, children }: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] text-gray-66 hover:text-white uppercase tracking-wider transition w-full"
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span>{title}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

function Segment<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr bg-black-18 rounded-lg p-0.5 gap-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs py-1.5 rounded transition ${
            value === opt.value
              ? 'bg-[#404243] text-white font-semibold'
              : 'text-gray-66 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function useDefaultSettings(): [ExportSettings, (s: ExportSettings) => void] {
  return useState<ExportSettings>({
    vehicleType: 'car',
    unit: 'kph',
    resolution: '1080p',
  })
}
