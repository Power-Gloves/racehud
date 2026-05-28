/**
 * Widget 注册表
 *
 * 每个 widget = 一个纯展示组件，输入是 WidgetContext，输出 ReactNode
 * 不关心位置、不关心主题（位置由 Layout 负责，主题由 CSS 变量/className 注入）
 *
 * 后续编辑器把 widget 当作"组件库"，用户拖拽到画布的不同位置
 */
import type { ComponentType } from 'react'
import type { WidgetContext } from '../types'
import SpeedNumber from './SpeedNumber'
import LapInfo from './LapInfo'
import LapList from './LapList'
import GForceBall from './GForceBall'
import MiniMap from './MiniMap'

export interface WidgetProps {
  ctx: WidgetContext
}

export interface WidgetDef {
  id: string
  name: string
  /** 默认大小，编辑器创建时用 */
  defaultSize: { w: number; h: number }
  Component: ComponentType<WidgetProps>
  /** 该 widget 是否依赖 DLAP 独有字段（如 lapNum）；VBO 数据时会显示提示或降级 */
  requiresLap?: boolean
}

export const WIDGETS: WidgetDef[] = [
  { id: 'speed',     name: '速度',       defaultSize: { w: 200, h: 110 }, Component: SpeedNumber },
  { id: 'lapInfo',   name: '圈号 / 计时',  defaultSize: { w: 280, h: 80 },  Component: LapInfo, requiresLap: true },
  { id: 'lapList',   name: '历圈榜',     defaultSize: { w: 200, h: 200 }, Component: LapList, requiresLap: true },
  { id: 'gforce',    name: 'G 球',       defaultSize: { w: 160, h: 160 }, Component: GForceBall },
  { id: 'miniMap',   name: '迷你赛道',    defaultSize: { w: 200, h: 200 }, Component: MiniMap },
]

export const WIDGETS_BY_ID = Object.fromEntries(WIDGETS.map(w => [w.id, w]))
