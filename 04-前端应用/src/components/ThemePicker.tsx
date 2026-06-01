import { THEMES } from '../themes'

interface Props {
  themeId: string
  onChange: (id: string) => void
}

/**
 * HUD 主题切换器：色块预览 + 名称，点击切换。
 * 主题渲染本身已迁到 Canvas，这里只展示色块缩略图。
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
            <div
              className="h-7 rounded flex items-center justify-center"
              style={{
                background: t.preview.bg,
                border: `1px solid ${t.preview.border}`,
                color: t.preview.text,
              }}
            >
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums">88</span>
                <span className="w-1 h-1 rounded-full" style={{ background: t.preview.accent }} />
              </div>
            </div>
            <div className={`text-xs mt-1 truncate ${active ? 'text-white font-semibold' : 'text-slate-200'}`}>
              {t.name}
            </div>
          </button>
        )
      })}
    </div>
  )
}
