# racehud

赛车视频 HUD 叠加 Web 工具：把 Dragy GPS log 叠加到车载视频上，导出带可定制 UI 图层的新视频。

## 目录结构

| 目录 | 说明 |
|------|------|
| `01-数据样本/` | Dragy `.vbo` / `.dlap` 测试样本 |
| `02-数据解析/` | VBO 解析器（纯 Node.js，可独立 `node test.js` 跑） |
| `03-后端服务/` | Express：文件上传、VBO 解析代理、视频元信息（后续：FFmpeg 渲染） |
| `04-前端应用/` | React + Vite + TS + Tailwind + recharts |
| `docs/` | 数据格式分析、设计文档 |

## 端口

| 服务 | 端口 |
|------|------|
| 后端 | `4001` |
| 前端 dev | `5174` |

## 快速启动

### 一键启动（推荐）

双击 **`启动.bat`**：
- 自动启动后端、前端
- 首次运行会自动 `npm install`
- 自动打开浏览器到 <http://localhost:5174>

停止：双击 **`停止.bat`**。

### 手动启动

```powershell
# 后端（端口 4001）
cd 03-后端服务 ; npm install ; node index.js

# 前端（端口 5174，新终端）
cd 04-前端应用 ; npm install ; npm run dev
```

### 单独测试 parser

```powershell
cd 02-数据解析 ; node test.js
```

## 数据格式

- ✅ **VBO**：10Hz、含 GPS/速度/heading/高度/卫星数，G 值由程序派生
- ✅ **DLAP**：AES-128-CBC 加密双层 ZIP，已破解。除 GPS 通道外还含**圈号 / 圈时对比 / 60Hz 加速度计**

详见 [docs/data-format.md](docs/data-format.md)。

## 开发路线

- [x] 数据格式分析
- [x] VBO parser（含派生通道：加速度、纵向/侧向 G、累计距离）
- [x] **DLAP parser（AES-128-CBC + 双层 ZIP，含圈号 / 圈时对比）**
- [x] 项目骨架（前后端 + 启停脚本）
- [x] 上传 + 自动识别格式 + 元数据展示 + 速度曲线 + 轨迹图
- [ ] 视频上传 + FFprobe 元信息
- [ ] 视频/数据时间对齐 UI
- [ ] HUD 编辑器（Konva 拖拽 + 数据通道绑定）
- [ ] 渲染管线（node-canvas → PNG 序列 → FFmpeg overlay）
- [ ] 导出参数面板（分辨率、码率、片段裁剪）
