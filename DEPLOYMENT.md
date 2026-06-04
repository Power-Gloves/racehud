# RaceHUD 部署指南

## 🚀 GitHub Pages 自动部署

### 配置步骤

#### 1. 启用GitHub Pages
1. 进入GitHub仓库页面
2. 点击 **Settings** → **Pages**
3. 在 **Source** 下选择：
   - Source: **GitHub Actions**
4. 保存设置

#### 2. 推送代码触发部署
```bash
git push origin main
```

#### 3. 查看部署状态
- 进入仓库的 **Actions** 标签页
- 查看 "Deploy to GitHub Pages" 工作流
- 等待构建完成（约2-3分钟）

#### 4. 访问网站
部署完成后，访问：
```
https://你的用户名.github.io/racehud/
```

### 工作流说明

自动部署工作流 (`.github/workflows/deploy.yml`)：
- **触发条件**：推送到main分支或手动触发
- **构建步骤**：
  1. 检出代码
  2. 安装Node.js 20
  3. 安装依赖 (npm ci)
  4. 构建生产版本 (npm run build)
  5. 上传构建产物
  6. 部署到GitHub Pages

---

## 📦 本地构建

### 开发模式
```bash
cd 04-前端应用
npm install
npm run dev
```
访问 http://localhost:5174

### 生产构建
```bash
cd 04-前端应用
npm run build
```
构建产物在 `dist/` 目录

### 预览生产构建
```bash
npm run preview
```

---

## 🌐 自定义域名（可选）

### 1. 添加CNAME文件
在 `04-前端应用/public/` 目录下创建 `CNAME` 文件：
```
your-domain.com
```

### 2. 配置DNS
在你的域名提供商添加DNS记录：

**CNAME记录**：
```
Type: CNAME
Name: www (或 @)
Value: 你的用户名.github.io
```

**A记录**（如果使用根域名）：
```
Type: A
Name: @
Value: 
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
```

### 3. 在GitHub设置自定义域名
Settings → Pages → Custom domain → 输入域名 → Save

---

## 🔧 环境配置

### Node.js版本
- 推荐: Node.js 20.x
- 最低: Node.js 18.x

### 依赖管理
使用 `npm ci` 而非 `npm install` 确保依赖版本一致

### 构建优化
- 代码自动压缩
- Tree-shaking去除未使用代码
- CSS自动优化
- 静态资源哈希化

---

## 📊 版本发布流程

### 1. 更新版本号
修改 `04-前端应用/src/App.tsx`：
```typescript
const VERSION = 'v2.0.1'
```

### 2. 更新CHANGELOG
在 `04-前端应用/CHANGELOG.md` 添加新版本说明

### 3. 提交并打标签
```bash
git add .
git commit -m "chore: release v2.0.1"
git tag v2.0.1
git push origin main --tags
```

### 4. 创建GitHub Release
1. 进入 **Releases** → **Create a new release**
2. 选择标签 `v2.0.1`
3. 填写标题和说明
4. 上传构建产物 `dist.zip`（可选）
5. 发布

---

## 🐛 故障排查

### 构建失败
1. 检查Node.js版本是否≥18
2. 删除 `node_modules` 和 `package-lock.json` 重新安装
3. 查看GitHub Actions日志

### 页面404
1. 确认GitHub Pages已启用
2. 检查 `vite.config.ts` 的 `base` 配置
3. 确认分支是 `main`

### 页面空白
1. 打开浏览器开发者工具查看错误
2. 检查资源路径是否正确
3. 确认 `base: './'` 配置正确

### 功能异常
1. 清除浏览器缓存
2. 检查浏览器版本（推荐Chrome 90+）
3. 确认视频文件格式支持

---

## 💡 性能优化建议

### CDN加速
使用jsDelivr加速GitHub Pages：
```
https://cdn.jsdelivr.net/gh/你的用户名/racehud@main/04-前端应用/dist/
```

### 浏览器缓存
所有静态资源都带哈希，支持长期缓存

### 代码分割
Vite自动按需加载，首屏加载更快

---

## 📝 更新日志

查看完整更新日志：[CHANGELOG.md](./04-前端应用/CHANGELOG.md)

---

## 🔒 安全说明

- 所有视频和GPS数据处理完全在浏览器本地完成
- 不上传任何数据到服务器
- 不使用任何第三方分析工具
- 开源代码，可自行审查

---

## 📞 技术支持

遇到问题？
1. 查看 [Issues](https://github.com/你的用户名/racehud/issues)
2. 提交新的Issue描述问题
3. 附上浏览器版本和错误截图

---

**最后更新**: 2026年6月  
**当前版本**: v2.0.0
