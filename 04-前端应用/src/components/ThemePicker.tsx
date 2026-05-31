import { THEMES } from '../themes'

interface Props {
  themeId: string
  onChange: (id: string) => void
}

/**
 * HUD 主题切换器：色块 chip，点击预览主题配色，激活主题加 ring
 */
export default function ThemePicker({ themeId, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {THEMES.map(t => {
        const active = t.id === themeId
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative rounded-md p-1 transition border ${
              active
                ? 'border-primary ring-2 ring-primary/40'
                : 'border-[#3a3a3a] hover:border-[#5a5a5a]'
            }`}
            title={t.name}
          >
            {/* 配色色块预览 */}
            <div
              className="h-7 rounded flex items-center justify-center"
              style={{
                background: t.preview.bg,
                border: `1px solid ${t.preview.border}`,
                color: t.preview.text,
              }}
            >
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums" style={{ fontFamily: t.vars['--hud-font-num'] }}>
                  88
                </span>
                <span className="w-1 h-1 rounded-full" style={{ background: t.preview.accent }} />
              </div>
            </div>
            {/* 名称 */}
            <div className={`text-xs mt-1 truncate ${active ? 'text-white font-semibold' : 'text-slate-200'}`}>
              {t.name}
            </div>
          </button>
        )
      })}
    </div>
  )
}
