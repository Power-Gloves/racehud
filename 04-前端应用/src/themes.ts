import type { CSSProperties } from 'react'

/**
 * HUD 主题：一组 CSS 变量
 *
 * 所有 widget 都用这些变量渲染，切换主题=换变量值，widget 代码不动
 *
 * 变量约定：
 *   --hud-bg          卡片背景（含透明度）
 *   --hud-border      边框颜色
 *   --hud-border-w    边框宽度
 *   --hud-radius      圆角
 *   --hud-text        主文字色
 *   --hud-text-dim    副文字色
 *   --hud-accent      强调色（最佳圈、激活态）
 *   --hud-good        好/快（绿色系）
 *   --hud-warn        差/慢（红色系）
 *   --hud-font-num    数字字体
 *   --hud-shadow      盒阴影/光晕
 *   --hud-blur        backdrop-filter blur
 */
export interface Theme {
  id: string
  name: string
  /** 用于 ThemePicker 显示的色块预览 */
  preview: { bg: string; border: string; text: string; accent: string }
  vars: Record<string, string>
}

export const THEMES: Theme[] = [
  {
    id: 'minimal',
    name: '极简',
    preview: { bg: '#000000', border: '#ffffff20', text: '#ffffff', accent: '#22d3ee' },
    vars: {
      // 渐变底片：顶部透明 → 底部淡黑，制造"信息贴在视频上"的浮层感
      '--hud-bg': 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.55) 100%)',
      '--hud-border': 'transparent',
      '--hud-border-w': '0',
      '--hud-radius': '4px',
      '--hud-text': '#ffffff',
      '--hud-text-dim': 'rgba(226, 232, 240, 0.85)',
      '--hud-accent': '#22d3ee',
      '--hud-good': '#34d399',
      '--hud-warn': '#fb7185',
      '--hud-font-num': '"JetBrains Mono", ui-monospace, monospace',
      '--hud-shadow': 'none',
      '--hud-blur': '0px',
      // 文字描边阴影：在任何视频背景上都可读
      '--hud-text-shadow': '0 1px 2px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)',
      '--hud-value-shadow': '0 2px 4px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.55)',
      // 左侧 accent 线（青色细条），赛车 HUD 经典手法
      '--hud-accent-line-w': '2.5px',
    },
  },
  {
    id: 'neon',
    name: '霓虹',
    preview: { bg: '#000814', border: '#22d3ee', text: '#22d3ee', accent: '#ec4899' },
    vars: {
      '--hud-bg': 'rgba(0, 8, 20, 0.7)',
      '--hud-border': '#22d3ee',
      '--hud-border-w': '1px',
      '--hud-radius': '2px',
      '--hud-text': '#22d3ee',
      '--hud-text-dim': '#67e8f9',
      '--hud-accent': '#ec4899',
      '--hud-good': '#a3e635',
      '--hud-warn': '#fb7185',
      '--hud-font-num': '"Aldrich", "Open Sans", monospace',
      '--hud-shadow': '0 0 12px rgba(34, 211, 238, 0.4)',
      '--hud-blur': '6px',
    },
  },
  {
    id: 'f1',
    name: 'F1 转播',
    preview: { bg: '#14141e', border: '#dc2626', text: '#ffffff', accent: '#facc15' },
    vars: {
      '--hud-bg': 'rgba(20, 20, 30, 0.88)',
      '--hud-border': '#dc2626',
      '--hud-border-w': '2px',
      '--hud-radius': '0px',
      '--hud-text': '#ffffff',
      '--hud-text-dim': '#9ca3af',
      '--hud-accent': '#facc15',
      '--hud-good': '#22c55e',
      '--hud-warn': '#dc2626',
      '--hud-font-num': '"Aldrich", "Open Sans", monospace',
      '--hud-shadow': '0 4px 12px rgba(0, 0, 0, 0.4)',
      '--hud-blur': '0px',
    },
  },
  {
    id: 'jdm',
    name: 'JDM 红黑',
    preview: { bg: '#0f0000', border: '#ef4444', text: '#ef4444', accent: '#fbbf24' },
    vars: {
      '--hud-bg': 'rgba(15, 0, 0, 0.85)',
      '--hud-border': '#ef4444',
      '--hud-border-w': '1px',
      '--hud-radius': '4px',
      '--hud-text': '#fee2e2',
      '--hud-text-dim': '#fca5a5',
      '--hud-accent': '#fbbf24',
      '--hud-good': '#86efac',
      '--hud-warn': '#ffffff',
      '--hud-font-num': '"Aldrich", "Open Sans", monospace',
      '--hud-shadow': '0 0 8px rgba(239, 68, 68, 0.3)',
      '--hud-blur': '4px',
    },
  },
  {
    id: 'race',
    name: '赛道荧光',
    preview: { bg: '#001f0f', border: '#22c55e', text: '#86efac', accent: '#facc15' },
    vars: {
      '--hud-bg': 'rgba(0, 31, 15, 0.82)',
      '--hud-border': 'rgba(34, 197, 94, 0.6)',
      '--hud-border-w': '1px',
      '--hud-radius': '4px',
      '--hud-text': '#bbf7d0',
      '--hud-text-dim': '#86efac',
      '--hud-accent': '#facc15',
      '--hud-good': '#4ade80',
      '--hud-warn': '#f87171',
      '--hud-font-num': '"Aldrich", "Open Sans", monospace',
      '--hud-shadow': '0 0 10px rgba(34, 197, 94, 0.25)',
      '--hud-blur': '5px',
    },
  },
]

export const DEFAULT_THEME_ID = 'minimal'

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function themeStyle(theme: Theme): CSSProperties {
  return theme.vars as CSSProperties
}
