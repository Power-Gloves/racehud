import { useState } from 'react'
import ThemePicker from './ThemePicker'
import { createPortal } from 'react-dom'

export interface ExportSettings {
  vehicleType: 'car' | 'motor'
  unit: 'kph' | 'mph'
  resolution: '720p' | '1080p' | '2k' | '4k'
  exportMode: 'full' | 'lap' | 'custom'  // 导出模式
  selectedLap?: number  // 选择的圈号（lap模式）
  customStart?: number  // 自定义起始时间（秒）
  customEnd?: number    // 自定义结束时间（秒）
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
  /** 圈信息（用于选择圈号） */
  laps?: Array<{ lapNum: number; lapTime: number }>
  /** 视频总时长（秒） */
  videoDuration?: number
}

/**
 * 右栏：设置 + HUD 主题 + 导出
 */
export default function SettingsPanel({
  settings, onChange, onExport, exportEnabled,
  exporting, exportProgress, onCancelExport,
  themeId, onThemeChange,
  autoLapPos, onAutoLapPosChange, autoLapEnabled,
  laps, videoDuration,
}: Props) {
  const [showLapTour, setShowLapTour] = useState(false)

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

      {/* 暂时隐藏车型和单位设置
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
      */}

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

      <Field label="导出范围">
        <Segment
          options={[
            { value: 'full', label: '整个视频' },
            { value: 'lap', label: '单圈' },
            { value: 'custom', label: '自定义' },
          ]}
          value={settings.exportMode}
          onChange={(v) => {
            const newMode = v as ExportSettings['exportMode']
            onChange({ ...settings, exportMode: newMode })
            // 切换到单圈模式且未选择时，显示Tour指引
            if (newMode === 'lap' && !settings.selectedLap) {
              setShowLapTour(true)
            }
          }}
        />
        {settings.exportMode === 'custom' && (
          <div className="mt-2 text-[10px] text-cyan-300">
            💡 在时间轴上拖动范围选择器（即将推出）
          </div>
        )}
      </Field>

      {/* Tour浮动指引 */}
      {showLapTour && settings.exportMode === 'lap' && !settings.selectedLap && createPortal(
        <LapSelectionTour onClose={() => setShowLapTour(false)} />,
        document.body
      )}

      {/* 单圈模式：显示已选择的圈号 */}
      {settings.exportMode === 'lap' && (
        <Field label="已选择">
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 text-sm bg-black-18 text-cyan-300 rounded border border-cyan-500/40">
              {settings.selectedLap 
                ? `第 ${settings.selectedLap} 圈 ${laps?.find(l => l.lapNum === settings.selectedLap)?.lapTime.toFixed(2)}s`
                : '未选择（请在时间轴右键点击圈数标签）'}
            </div>
            {settings.selectedLap && (
              <button
                onClick={() => onChange({ ...settings, selectedLap: undefined })}
                className="shrink-0 px-3 py-2 text-sm bg-[#404243] hover:bg-[#505253] text-slate-300 hover:text-white rounded transition"
                title="清除选择"
              >
                ✕
              </button>
            )}
          </div>
        </Field>
      )}

      {/* 自定义模式：输入起止时间 */}
      {settings.exportMode === 'custom' && videoDuration && (
        <div className="space-y-2">
          <Field label="起始时间（秒）">
            <input
              type="number"
              min={0}
              max={videoDuration}
              step={0.1}
              value={settings.customStart ?? 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) onChange({ ...settings, customStart: Math.max(0, Math.min(videoDuration, val)) })
              }}
              className="w-full px-3 py-2 text-sm bg-black-18 text-white rounded border border-gray-600 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="结束时间（秒）">
            <input
              type="number"
              min={0}
              max={videoDuration}
              step={0.1}
              value={settings.customEnd ?? videoDuration}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) onChange({ ...settings, customEnd: Math.max(0, Math.min(videoDuration, val)) })
              }}
              className="w-full px-3 py-2 text-sm bg-black-18 text-white rounded border border-gray-600 focus:border-primary focus:outline-none"
            />
          </Field>
        </div>
      )}

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
    exportMode: 'full',
  })
}

/** Tour浮动指引组件 - 聚光灯效果指向时间轴圈数区域 */
function LapSelectionTour({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* 半透明遮罩层 - 加深遮罩 */}
      <div 
        className="absolute inset-0 bg-black/85 pointer-events-auto animate-fadeIn"
        onClick={onClose}
      />
      
      {/* 聚光灯区域 - 高亮时间轴底部圈数标签区域 */}
      <div 
        className="absolute bottom-3 left-3 right-[463px] h-[100px] pointer-events-none bg-transparent"
        style={{
          boxShadow: `
            0 0 0 9999px rgba(0,0,0,0.85),
            inset 0 0 80px 20px rgba(251,146,60,0.4),
            0 0 100px 30px rgba(251,146,60,0.6),
            0 0 150px 50px rgba(251,146,60,0.3)
          `,
          borderRadius: '12px',
          animation: 'pulseStrong 2s ease-in-out infinite',
        }}
      >
        {/* 内部边框高亮 */}
        <div className="absolute inset-0 border-4 border-orange-400 rounded-xl animate-pulse" />
        
        {/* 区域内文字提示 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-full shadow-2xl animate-bounce">
            <div className="flex items-center gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-bold text-base">👆 右键点击任意圈数标签选择导出</span>
            </div>
          </div>
        </div>
        
        {/* 顶部箭头指示 */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex flex-col items-center gap-2 animate-bounce">
            <div className="bg-orange-500 text-white px-5 py-2 rounded-lg shadow-lg font-bold text-sm whitespace-nowrap">
              在这里右键点击圈数 👇
            </div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 5L12 19M12 19L7 14M12 19L17 14" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* 指引气泡 - 定位在时间轴右上方，加大尺寸 */}
      <div 
        className="absolute bottom-[120px] right-[480px] pointer-events-auto animate-slideUp"
        style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}
      >
        <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl shadow-2xl p-6 max-w-[360px] ring-4 ring-orange-400/50">
          {/* 箭头指向时间轴 - 加粗 */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[16px] border-t-orange-600" />
          
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 bg-white/30 rounded-full flex items-center justify-center animate-bounce shadow-lg">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 5L12 19M12 19L7 14M12 19L17 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2 text-shadow">选择要导出的圈数</h3>
              <p className="text-sm text-orange-50 leading-relaxed mb-4">
                在下方时间轴的圈数标签上<span className="font-bold text-white bg-white/30 px-2 py-1 rounded ml-1 shadow-sm">右键点击</span>
              </p>
              <div className="flex items-center gap-3 text-sm text-orange-100 bg-white/10 p-3 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-5 h-5 bg-white/40 rounded border border-white/60" />
                  <span>Lap1</span>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-pulse">
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-5 h-5 bg-orange-300 rounded ring-2 ring-white shadow-lg" />
                  <span className="font-semibold">右键选择</span>
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 w-8 h-8 bg-white text-orange-600 rounded-full hover:bg-orange-50 transition shadow-xl flex items-center justify-center font-bold text-base hover:scale-110"
          >
            ✕
          </button>
        </div>
      </div>

      {/* CSS动画 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulseStrong {
          0%, 100% { 
            box-shadow: 
              0 0 0 9999px rgba(0,0,0,0.85),
              inset 0 0 80px 20px rgba(251,146,60,0.4),
              0 0 100px 30px rgba(251,146,60,0.6),
              0 0 150px 50px rgba(251,146,60,0.3);
          }
          50% { 
            box-shadow: 
              0 0 0 9999px rgba(0,0,0,0.85),
              inset 0 0 120px 30px rgba(251,146,60,0.6),
              0 0 150px 50px rgba(251,146,60,0.8),
              0 0 200px 80px rgba(251,146,60,0.5);
          }
        }
      `}</style>
    </div>
  )
}
