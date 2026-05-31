import type { CSSProperties } from 'react'
import type { WidgetContext } from '../types'
import { WIDGETS_BY_ID, type WidgetDef } from '../widgets'
import { Theme, themeStyle } from '../themes'

/**
 * Widget 在视频画面上的位置定义（百分比 + 锚点，分辨率无关）
 */
export interface WidgetPlacement {
  widgetId: string
  anchor: 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc' | 'cl' | 'cr'
  /** 距锚点偏移（相对视频宽/高 0-1）*/
  offsetX: number
  offsetY: number
  /** 大小（相对视频宽/高 0-1）*/
  width: number
  height: number
  visible: boolean
}

export interface HudLayout {
  id: string
  name: string
  placements: WidgetPlacement[]
}

/** 默认布局：紧凑版本，每个 widget 占视频面积的小份额 */
export const DEFAULT_LAYOUT: HudLayout = {
  id: 'default',
  name: '默认布局',
  placements: [
    { widgetId: 'miniMap', anchor: 'tl', offsetX: 0.02, offsetY: 0.02, width: 0.13, height: 0.20, visible: true },
    { widgetId: 'lapInfo', anchor: 'tc', offsetX: 0,    offsetY: 0.02, width: 0.30, height: 0.10, visible: true },
    { widgetId: 'lapList', anchor: 'tr', offsetX: 0.02, offsetY: 0.02, width: 0.14, height: 0.30, visible: true },
    { widgetId: 'speed',   anchor: 'bl', offsetX: 0.02, offsetY: 0.04, width: 0.14, height: 0.16, visible: true },
    { widgetId: 'gforce',  anchor: 'br', offsetX: 0.02, offsetY: 0.04, width: 0.13, height: 0.20, visible: true },
  ],
}

interface Props {
  ctx: WidgetContext
  layout: HudLayout
  theme: Theme
}

/**
 * HUD 覆盖层：absolute 覆盖在视频之上
 *
 * 主题：把主题的 CSS 变量注入到容器 style，所有 widget 用这些变量渲染
 */
export default function HudOverlay({ ctx, layout, theme }: Props) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={themeStyle(theme)}
    >
      {layout.placements
        .filter(p => p.visible)
        .map((p, i) => {
          const def: WidgetDef | undefined = WIDGETS_BY_ID[p.widgetId]
          if (!def) return null
          if (def.requiresLap && ctx.laps.length === 0) return null
          const Comp = def.Component
          return (
            <div key={i} style={placementStyle(p)} className="absolute">
              <Comp ctx={ctx} />
            </div>
          )
        })}
    </div>
  )
}

function placementStyle(p: WidgetPlacement): CSSProperties {
  const w = `${(p.width * 100).toFixed(2)}%`
  const h = `${(p.height * 100).toFixed(2)}%`
  const ox = `${(p.offsetX * 100).toFixed(2)}%`
  const oy = `${(p.offsetY * 100).toFixed(2)}%`
  const style: CSSProperties = { width: w, height: h }
  switch (p.anchor) {
    case 'tl': style.top = oy; style.left = ox; break
    case 'tr': style.top = oy; style.right = ox; break
    case 'bl': style.bottom = oy; style.left = ox; break
    case 'br': style.bottom = oy; style.right = ox; break
    case 'tc':
      style.top = oy
      style.left = '50%'
      style.transform = `translateX(calc(-50% + ${ox === '0%' ? '0px' : ox}))`
      break
    case 'bc':
      style.bottom = oy
      style.left = '50%'
      style.transform = `translateX(calc(-50% + ${ox === '0%' ? '0px' : ox}))`
      break
    case 'cl':
      style.top = '50%'
      style.left = ox
      style.transform = 'translateY(-50%)'
      break
    case 'cr':
      style.top = '50%'
      style.right = ox
      style.transform = 'translateY(-50%)'
      break
  }
  return style
}
