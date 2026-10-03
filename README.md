# RaceHUD

在浏览器中把赛车视频与 GPS 遥测叠加，支持 GoPro 内嵌 GPS，以及 DJI / 其他视频配外置 DLAP、VBO 数据。核心解析、预览和导出在本机浏览器完成。

当前版本 **v2.5.0**：双圈对比采用左侧行车线、右侧速度与 delta 图表布局，支持同位置分析、同时间回放和图表联动定位。保留磁盘流式导出与十二套主题。

[在线使用](https://power-gloves.github.io/racehud/)

- [更新说明](docs/release-v2.5.0.md)
- [项目上下文与目录职责](CONTEXT.md)
- [已修复问题及待处理清单](docs/project-audit.md)
- [本地测试步骤](docs/local-testing.md)

## 本地运行

需要 Node.js 20 或更新版本，推荐使用支持 WebCodecs 的新版 Chrome / Edge。

```powershell
cd 04-前端应用
npm ci
npm run dev -- --host 127.0.0.1
```

打开 `http://127.0.0.1:5174/`。不需要启动历史后端服务。

```powershell
npm test
npm run build:check
```

`main` 分支推送后由 GitHub Actions 测试、构建并部署 GitHub Pages。生产文件在 `04-前端应用/dist`。

## 使用

1. 选择「带 GPS 的视频」导入 GoPro，或选择「视频 + 外置 GPS」分别导入视频和 DLAP/VBO。
2. 外置模式可尝试智能对齐；若视频不包含受支持的加速度数据，使用手动对齐。当前 DJI 实拍验证覆盖 Action 4。
3. 在右侧主题缩略图选择布局。需要重分圈时调整起跑线位置；DLAP 点击 Auto 可恢复设备圈号。
4. 在时间轴右键选圈，设置前后缓冲与冲线红灯，然后导出；也可输入自定义秒数范围。新版 Chrome / Edge 会先询问保存位置，再边编码边写盘。行车线距离只显示在时间轴，不导出。
5. 当视频和 GPS 至少覆盖两圈完整记录时，点击顶部「双圈对比」；选择 A、B 两圈后，可同步播放两段画面、拖动共同进度，并查看叠加行车线。对比页不会修改原视频或导出选择。

新字体许可位于 `04-前端应用/src/assets/fonts`。历史源码、文档中的已知限制见审查清单，不代表所有机型与所有输入格式已经验收。
