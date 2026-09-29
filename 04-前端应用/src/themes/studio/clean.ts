import type { Theme } from '../types'
import { design, text, line, values, map, mono } from './graphics'

/** 圆角模块只承载必要信息，统一内边距和描边。 */
function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string) {
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, 18)
  c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); c.restore()
}
function badge(c: CanvasRenderingContext2D, label: string, x: number, y: number, color: string) {
  c.beginPath(); c.arc(x, y - 5, 3, 0, Math.PI * 2); c.fillStyle = color; c.fill()
  text(c, label, x + 13, y, 16, color, mono)
}

export const cleanThemes: Theme[] = [
  {
    id: 'azure', name: '蓝白航线',
    preview: { bg: '#eaf2ff', border: '#3478f6', text: '#112a50', accent: '#3478f6' },
    drawHud(c, f) { design(c, f, () => {
      const v = values(f), blue = '#3478f6', navy = '#112a50'
      // 蓝色速度舱和白色计时舱共用基线，减少大面积白块。
      panel(c, 64, 862, 236, 150, '#255ddfeF', '#87b5ff88')
      text(c, v.speed, 88, 975, 105, '#ffffff')
      text(c, v.unit, 276, 988, 16, '#d9e8ff', mono, 'right')
      panel(c, 312, 902, 552, 110, '#f5f8fff0', '#ffffffaa')
      badge(c, 'LAP ' + v.lap, 336, 934, blue)
      text(c, v.elapsed, 336, 984, 40, navy)
      line(c, 573, 925, 573, 989, '#ccd9ed', 1)
      text(c, 'PERSONAL BEST', 599, 934, 15, '#6482a4', mono)
      text(c, v.best, 599, 984, 40, navy)
      panel(c, 1640, 64, 216, 216, '#102747cc', '#9dc6ff44')
      badge(c, 'CIRCUIT', 1662, 94, '#bad5ff')
      map(c, f, 1664, 115, 168, 137, '#b9d8ff')
      line(c, 64, 848, 145, 848, blue, 3)
    }) },
  },
  {
    id: 'mint', name: '薄荷留白',
    preview: { bg: '#112b29', border: '#92e8cd', text: '#f1fff8', accent: '#92e8cd' },
    drawHud(c, f) { design(c, f, () => {
      const v = values(f), mint = '#92e8cd', white = '#f1fff8'
      panel(c, 64, 64, 354, 102, '#102c29df', '#92e8cd44')
      badge(c, 'LAP ' + v.lap, 89, 95, mint)
      text(c, v.elapsed, 89, 143, 42, white)
      // 开放式速度排版，窄底板保证路面上的对比度。
      panel(c, 1592, 837, 264, 175, '#102c29de', '#92e8cd44')
      text(c, v.speed, 1828, 958, 118, white, undefined, 'right')
      text(c, v.unit, 1828, 987, 16, mint, mono, 'right')
      line(c, 1619, 977, 1714, 977, mint, 2)
      for (let i = 0; i < 6; i++) line(c, 1619 + i * 19, 972, 1619 + i * 19, 982, mint, 1)
      panel(c, 64, 930, 358, 82, '#102c29de', '#92e8cd44')
      text(c, 'BEST LAP', 88, 958, 15, mint, mono)
      text(c, v.best, 398, 991, 34, white, undefined, 'right')
      map(c, f, 83, 740, 169, 143, mint)
    }) },
  },
  {
    id: 'coral', name: '珊瑚刻线',
    preview: { bg: '#28242a', border: '#ffa68b', text: '#fff4ec', accent: '#ffa68b' },
    drawHud(c, f) { design(c, f, () => {
      const v = values(f), coral = '#ffa68b', white = '#fff4ec'
      // 短而居中的数据坞，暖色速度铭牌形成视觉重心。
      panel(c, 523, 886, 874, 126, '#24242be8', '#f8dcc733')
      panel(c, 535, 898, 202, 102, '#ffa68b', '#ffdacb')
      text(c, v.speed, 556, 979, 78, '#352a2b')
      text(c, v.unit, 718, 986, 15, '#623f3d', mono, 'right')
      badge(c, 'LAP ' + v.lap, 764, 930, coral)
      text(c, v.elapsed, 764, 983, 43, white)
      line(c, 1045, 913, 1045, 986, '#f8dcc733', 1)
      text(c, 'BEST', 1073, 930, 16, '#bdaca8', mono)
      text(c, v.best, 1073, 983, 43, white)
      panel(c, 1648, 948, 208, 64, '#24242bdc', '#f8dcc733')
      text(c, 'Δ', 1667, 990, 23, coral, mono)
      text(c, v.delta, 1837, 990, 27, white, mono, 'right')
      map(c, f, 78, 827, 171, 156, coral)
    }) },
  },
]
