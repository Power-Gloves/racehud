/**
 * 主题注册表
 *
 * 加新主题：
 *   1. 在 builtin/ 下加一个 .ts 文件，导出 Theme 对象
 *   2. 在这里 import 并加进 THEMES 数组
 *   完成。零其它代码改动。
 */
import { minimalTheme } from './builtin/minimal'
import { neonTheme } from './builtin/neon'
import { f1Theme } from './builtin/f1'
import { jdmTheme } from './builtin/jdm'
import { raceTheme } from './builtin/race'
import { customTheme } from './builtin/custom'
import type { Theme } from './types'

export const THEMES: Theme[] = [
  minimalTheme,
  neonTheme,
  f1Theme,
  jdmTheme,
  raceTheme,
  customTheme,
]

export const DEFAULT_THEME_ID = 'minimal'

export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

export type { Theme, HudFrame, ThemePreview } from './types'
