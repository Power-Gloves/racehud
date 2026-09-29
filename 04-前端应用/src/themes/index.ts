/**
 * 主题注册表
 *
 * 加新主题：
 *   1. 在 builtin/ 下加一个 .ts 文件，导出 Theme 对象
 *   2. 在这里 import 并加进 THEMES 数组
 *   完成。零其它代码改动。
 */
import { minimalTheme } from './builtin/minimal'
import { studioThemes } from './studio/themes'
import { cleanThemes } from './studio/clean'
import { customTheme, customNoLapTheme } from './builtin/custom'
import type { Theme } from './types'

export const THEMES: Theme[] = [
  minimalTheme,
  ...cleanThemes,
  ...studioThemes,
  customTheme,
  customNoLapTheme,
]

export const DEFAULT_THEME_ID = 'minimal'

export function getTheme(id: string): Theme {
  const legacy: Record<string, string> = { neon: 'slipstream', f1: 'apex', jdm: 'roadbook', race: 'chrono' }
  return THEMES.find(t => t.id === (legacy[id] ?? id)) ?? THEMES[0]
}

export type { Theme, HudFrame, ThemePreview } from './types'
