# RaceHUD 项目上下文

更新：2026-09-11。用户要求：先理解全仓库，再以已有 GoPro 体验为标准补齐 DJI 视频 + 外置 GPS 模式，检查计算及其他缺陷。不要将迁移方向颠倒。

最新调整：2026-09-29，v2.3.0 长片导出内存修复及三个简约配色主题，详见文末。

## 目录与运行边界

| 目录 | 用途 |
| --- | --- |
| `01-数据样本` | 本地 MP4、Dragy DLAP 和历史 UI PDF；当前 DLAP 日期为 2026-05-30，旧测试引用的 05-23 文件不存在。视频与 DLAP 文件名日期不同，不能当成同一场比赛验证对齐。 |
| `02-数据解析` | Node CommonJS VBO/DLAP 解析器及历史打印式测试。 |
| `03-后端服务` | Express 解析接口、上传及静态托管；当前前端核心流程不调用这些接口。 |
| `04-前端应用` | 实际产品：React 18、TypeScript、Vite、Canvas HUD、mediabunny 本地视频导出。 |
| `docs` | 数据格式知识及本次审查记录。 |
| `overlay_dump`、`overlay.html` | 历史外部产品前端抓取/分析资料，不属于应用运行源码。 |
| `.agents/skills` | 浏览器自动化技能及历史抓取资源，不属于产品模块。 |
| `.github/workflows` | GitHub Pages 静态构建部署。 |
| `.vscode`、`.git` | 编辑器和版本管理状态。 |
| 根目录 BAT、发布文档、ZIP | 本地启动停止、历史部署说明与打包产物；修改源码不会自动更新旧 ZIP。 |

前端开发端口 5174，后端 4001。核心功能在浏览器完成，前端 `npm run build:check` 是严格类型检查加生产构建；原 CI 仅 build，跳过类型错误。README 已补充运行、发布与文档入口。

## 数据流

`LibraryPanel / 页面拖放 → App → telemetry → Sample[] → 分圈 → 预览/HUD/Timeline → exporter`。

- GoPro：MP4 样本表 → GPMF GPS5/GPS9 + ACCL → 经纬度、速度与派生 G → 自动分圈。
- DJI + 外置：DLAP（ZIP → AES → ZIP → CIR）或 VBO 文本提供 GPS；DJI djmd/protobuf 提供对齐加速度。现有 DJI 适配器仅识别 Action 4 的 `dvtm_ac203`，不能宣称支持全部 DJI 机型。
- `themes/index.ts` 注册九个 HUD 主题（极简、六个 studio 新主题、两个 DSK），`widgets.ts` 共用绘图；两种模式本来就共用主题和 Canvas。这里的图层指现有 HUD 叠加，不存在独立图片图层编辑器。
- `useLaps` 派生圈、最佳圈、当前圈；`autoLap` 检测过线及距离对齐秒差。
- `exporter` 解码视频，绘制同一主题，编码 H.264/AAC 并下载。

## 时间和单位约定

`Sample.t`、meta 起止、offset、playhead 均为毫秒；视频时间及圈时为秒。GPS5 无 UTC 时可能使用相对毫秒。

序列时刻 S、视频起点 V、数据起点 D、GPS 原始起点 G：

```
videoSec = (S - V) / 1000
gpsT = G + S - D
gpsT = G + videoSec * 1000 + V - D
videoSec = (gpsT - G + D - V) / 1000
```

经纬度为度，速度 km/h，加速度 m/s²，gLong/gLat 为 G，距离米，lapTimeInLap 毫秒，bestCompare 秒。

## 本次调整原则

统一导入和派生流程，不复制 GoPro 界面。DLAP 默认保留设备圈号及设备秒差；移动起跑线时重算，重置时恢复原始数据。VBO 和内嵌 GPS 自动分圈。重新分圈不得重置视频/GPS 对齐或播放位置。文件替换、移除、模式切换应使旧异步结果失效。

时间换算、导出范围与 HUD 插值复用统一逻辑。导出选择采用单一状态。没有可靠信号时保持手动对齐；不凭低质量互相关修改现有偏移。

## 单圈附加功能（2026-09-11）

- `themes/startLights.ts`：所选圈前最多五秒逐盏亮起红灯，冲线全部熄灭，450ms 内退场。短缓冲按实际时长压缩；零缓冲或非单圈导出不显示。`themes/render.ts` 是预览和导出的共用绘制入口，效果不依赖动画历史。
- `telemetry/lapDistance.ts`：以采样累计距离在圈边界处插值，得到每圈路径长度和当前已行驶距离。仅 `Timeline` 显示，禁止添加到导出 HUD。尾部记录段不应标成完整圈。长度是 GPS 行车线估算，不是场地面积。

## 验证边界

使用确定性合成轨迹/信号验证数学性质，使用当前真实 DLAP 验证解析和 UI。用户后续提供 `D:/myApp/kart/湖北宜昌` 下 DJI MP4 + DLAP，已用于实拍验证：自动对齐偏移 272.68 秒、相关系数约 0.945；完整导出和分段复核见审查记录。完整审查进展见 `docs/project-audit.md`。

## v2.2.0 主题发布

新增 themes/studio 的六种独立布局，保留极简和 DSK 原版。新主题无逐帧历史状态，路径 WeakMap 缓存；本地字体位于 src/assets/fonts，导出先等待字体。选择器 DSK 仅用静态示意，禁止为了缩略图调用其全局有状态绘制。发布说明见 docs/release-v2.2.0.md。回归共 12 组。

## v2.3.0 长片导出

- `export/storage.ts` 创建磁盘 StreamTarget，2 MiB 分块。支持保存选择器时直接写选定文件，否则 OPFS 临时文件；正常完成才提交，取消和失败 abort 未提交写入。
- `exporter.ts` 必须显式使用 `fastStart:false`，禁止恢复 BufferTarget 或构建完整输出 ArrayBuffer。CanvasSink 使用两个循环画布。
- `exportVideo` 返回磁盘 File（Blob 子类）；有 destination 时 App 不再次下载；无 destination 时 downloadBlob 负责下载并延迟清理。直接调用者通过 releaseExport 清理临时文件。
- 新增 `studio/clean.ts` 的蓝白、薄荷、珊瑚主题，目前注册十二套。
- 原数学回归加实际复用器存储回归在 `npm test` 中执行。实拍素材为麦浪 8.88 GB / 2070.165 秒 HEVC 视频与 DLAP；完整记录见 v2.3.0 发布说明。
