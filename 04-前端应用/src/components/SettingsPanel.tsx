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
            <div className="text-[10px] text-gray-66 mt-1">
              {autoLapPos == null ? '算法自动选择' : `沿轨迹 ${Math.round(autoLapPos * 100)}%`}
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

      <button
        onClick={onExport}
        disabled={!exportEnabled}
        className="w-full py-3 bg-primary hover:opacity-90 disabled:bg-black-18 disabled:text-gray-66 text-white font-semibold rounded text-base transition uppercase tracking-wider"
      >
        Export All Laps
      </button>
      <p className="text-[10px] text-gray-66 text-center -mt-2">
        每段前后会附加 5 秒以确保完整圈
      </p>
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
