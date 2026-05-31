import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部署到 GitHub Pages 子路径（仓库名 racehud）
// 用 './' 相对路径，让 zip 解压双击 index.html 也能跑
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5174,
  },
})
