/**
 * HUD Canvas 渲染层
 *
 * 替代旧的 React HudOverlay。在视频画面上覆盖一个 canvas，
 * 每次数据/playhead 变化都调用当前主题的 drawHud 重绘。
 *
 * 这个组件用的 canvas 渲染逻辑跟"导出"完全一样——所见即所得。
 */
import { useEffect, useRef } from 'react'
import type { Theme, HudFrame } from '../themes'

interface Props {
  theme: Theme
  frame: HudFrame
  /** Stage 内部画布固定尺寸（如 1920×1080），canvas 物理像素与之相同 */
  designWidth: number
  designHeight: number
}

export default function HudCanvas({ theme, frame, designWidth, designHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // 用 frame 里的尺寸（外层保证它和 designWidth/Height 一致）
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    theme.drawHud(ctx, frame)
  }, [theme, frame])

  return (
    <canvas
      ref={canvasRef}
      width={designWidth}
      height={designHeight}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}
