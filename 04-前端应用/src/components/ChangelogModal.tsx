import { createPortal } from 'react-dom'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function ChangelogModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      
      {/* 弹窗 */}
      <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-orange-500/30 animate-slideUp">
        {/* 头部 */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">RaceHUD v2.5.0</h2>
              <p className="text-sm text-orange-100">双圈速度曲线 · 位置对齐与秒差分析</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition text-white font-bold text-xl"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] px-6 py-6 space-y-6">
          <Section icon="📈" title="v2.5.0 双圈速度与秒差分析" badge="NEW">
            <p className="text-slate-300 leading-7">双圈对比统一深灰面板风格，下方左侧为紧凑行车线，右侧展示两圈速度与 delta 曲线。悬停查看对应位置的速度和用时；点击或拖动图表，同时定位两个视频。支持区段放大与全圈恢复。</p>
            <p className="mt-3 text-slate-300 leading-7">新增“同位置分析”，保留“同时间回放”。A 为参考圈，delta = B 到达对应位置的用时 − A 用时：红色正值表示 B 慢，绿色负值表示 B 快。GPS 位置匹配偏差较大时提示距离比例估算；分析只用于查看。</p>
          </Section>
          <Section icon="🏁" title="v2.4.0 双圈对比与冲线灯优化" badge="历史">
            <p className="text-slate-300 leading-7">加载视频和 GPS 后，点击顶部“双圈对比”，可以同时播放两圈画面，并在同一张地图上比较行车线、圈时、行驶距离与速度。只有具备完整冲线及视频覆盖的圈可供选择。</p>
            <p className="mt-3 text-slate-300 leading-7">五盏冲线红灯缩小并移到画面中上方，降低遮挡；点灯节奏不变。优化播放时的分圈与距离计算，并修复快速连续加载外置 GPS 和视频时偶发的数据丢失。</p>
          </Section>
          <Section icon="🎬" title="v2.3.0 长片导出内存修复" badge="历史">
            <p className="text-slate-300 leading-7">导出改为分块写入磁盘，复用解码画布，减少长片和分段导出的内存占用。Chrome / Edge 会先选择保存位置，成功后提交文件；取消时放弃未完成写入。</p>
            <p className="mt-3 text-slate-300 leading-7">新增蓝白航线、薄荷留白、珊瑚刻线三套简约主题，现在共十二套主题。</p>
          </Section>
          <Section icon="🎨" title="v2.2.0 六种布局，六种风格" badge="历史">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HighlightCard icon="01" title="极点转播 / 精密计时" desc="朱红转播记分牌与冷银中央仪表，突出实时速度和圈时。" />
              <HighlightCard icon="02" title="拉力路书 / 耐力工程" desc="琥珀纵向导航与底部工程数据带；数据带附带最近 8 秒速度曲线。" />
              <HighlightCard icon="03" title="轻量尾流 / 经典勒芒" desc="酸柠绿开放排版与奶油暗红复古表盘，适合不同视频氛围。" />
              <HighlightCard icon="04" title="保留极简与两个 DSK" desc="原版视觉保留；选择器增加布局缩略图，新主题字体随应用打包。" />
            </div>
          </Section>
          <Section icon="🏁" title="两种 GPS 模式与单圈功能" badge="UPDATE">
            <p className="text-slate-300 leading-7">DJI + 外置 GPS 补齐起跑线调整、分圈和按圈导出流程。单圈起点前可显示五盏红灯，冲线同时熄灭；时间轴增加每圈行车线长度与圈内已行驶距离，距离仅在系统显示。</p>
            <p className="mt-3 text-sm text-slate-400">修复时间偏移、尾圈参与最佳圈、低速漏分圈及文件切换时的异步覆盖。当前 DJI 实拍验证覆盖 Action 4；其他机型、长视频 4K 和 DSK 历史状态问题仍需进一步验证。</p>
          </Section>
          {/* 以下为旧版历史记录 */}
          <Section
            icon="🎬"
            title="v2.1.0 导出修复与优化"
            badge="历史"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HighlightCard
                icon="✅"
                title="修复音视频同步"
                desc="解决系统播放器/剪映无法正常播放的问题，时间轴长度现在准确"
              />
              <HighlightCard
                icon="⏱️"
                title="自定义缓冲时间"
                desc="单圈导出支持自定义前置/后置缓冲秒数，默认前后各5秒"
              />
              <HighlightCard
                icon="🎨"
                title="DSK专属（无圈速版）"
                desc="新增纯净版主题，去掉弯道速度标签，适合视频分享"
              />
              <HighlightCard
                icon="🔧"
                title="布局精细调整"
                desc="左下角组件位置、速度数字、R值标签等多处细节优化"
              />
            </div>
          </Section>

          <div className="border-t border-[#303030]" />

          {/* DSK专属主题 */}
          <Section
            icon="🎨"
            title="v2.0.0 DSK专属主题"
          >
            <Feature>
              <FeatureTitle>左下角速度表</FeatureTitle>
              <ul className="text-sm text-slate-300 space-y-1 ml-4">
                <li>• 8点钟到2点钟弧形设计，渐变配色（绿→黄→红）</li>
                <li>• 速度数字固定位置右对齐，避免跳动</li>
              </ul>
            </Feature>

            <Feature>
              <FeatureTitle>G力球系统</FeatureTitle>
              <ul className="text-sm text-slate-300 space-y-1 ml-4">
                <li>• 三层同心圆显示G力范围</li>
                <li>• 四色极值痕迹：粉色左转/蓝色右转/绿色加速/红色刹车</li>
                <li>• 底部R-值实时显示</li>
              </ul>
            </Feature>

            <Feature>
              <FeatureTitle>右上角圈速列表</FeatureTitle>
              <ul className="text-sm text-slate-300 space-y-1 ml-4">
                <li>• 实时秒差胶囊：横向水平仪设计</li>
                <li>• 显示最近5圈，紫色最快圈/绿色当前圈</li>
                <li>• 平滑滚动动画</li>
              </ul>
            </Feature>

            <Feature>
              <FeatureTitle>智能弯道标签</FeatureTitle>
              <ul className="text-sm text-slate-300 space-y-1 ml-4">
                <li>• 自动检测刹车弯</li>
                <li>• 记录入弯前最高速度和弯中最低速度</li>
                <li>• 出弯后闪烁提示，3秒后渐隐</li>
              </ul>
            </Feature>
          </Section>

          {/* Timeline可视化导出 */}
          <Section
            icon="🎬"
            title="Timeline可视化导出"
            badge="HOT"
            badgeColor="bg-red-500"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HighlightCard
                icon="🎯"
                title="Product Tour引导"
                desc="首次使用时自动显示操作指引"
              />
              <HighlightCard
                icon="🟠"
                title="聚光灯高亮"
                desc="时间轴圈数区域高亮提示"
              />
              <HighlightCard
                icon="📊"
                title="视频轨道范围框"
                desc="直观显示导出片段"
              />
              <HighlightCard
                icon="⏱️"
                title="智能缓冲"
                desc="自动添加前3秒+后2秒"
              />
            </div>

            <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <div className="font-semibold text-cyan-300 mb-1">如何导出单圈视频</div>
                  <ol className="text-sm text-slate-300 space-y-1">
                    <li>1. 在右侧设置选择"导出范围" → "单圈"</li>
                    <li>2. 在时间轴底部圈数标签上<span className="text-orange-300 font-bold">右键点击</span>要导出的圈</li>
                    <li>3. 圈数标签变为橙色，确认选择正确</li>
                    <li>4. 点击"导出带HUD的视频"</li>
                  </ol>
                </div>
              </div>
            </div>
          </Section>

          {/* 所见即所得 */}
          <Section
            icon="✨"
            title="所见即所得导出"
          >
            <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🎯</span>
                <div className="font-semibold text-emerald-300 text-lg">导出效果与预览100%一致</div>
              </div>
              <p className="text-sm text-slate-300">
                修复了不同分辨率导致的布局变形问题。无论选择720p、1080p、2K还是4K，
                所有HUD组件的布局、字体大小、间距都将完美保持，就像预览时看到的那样！
              </p>
            </div>
          </Section>

          {/* 其他改进 */}
          <Section
            icon="🛠️"
            title="其他改进"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FixItem>✅ 修复导出不同分辨率时HUD布局变形</FixItem>
              <FixItem>✅ 修复秒差胶囊显示为直线而非圆角</FixItem>
              <FixItem>✅ 修复最快圈秒差显示为0的问题</FixItem>
              <FixItem>✅ 修复G力球方向错误</FixItem>
              <FixItem>✅ 修复弯道检测不稳定</FixItem>
              <FixItem>✅ 优化UI布局和交互</FixItem>
            </div>
          </Section>
        </div>

        {/* 底部 */}
        <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-[#303030] px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            导出在浏览器本地完成，不上传任何数据
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg transition"
          >
            开始使用
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}

function Section({ icon, title, badge, badgeColor = 'bg-orange-500', children }: {
  icon: string
  title: string
  badge?: string
  badgeColor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        {badge && (
          <span className={`${badgeColor} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="pl-4 border-l-2 border-orange-500/30 space-y-2">
      {children}
    </div>
  )
}

function FeatureTitle({ children }: { children: React.ReactNode }) {
  return <div className="font-semibold text-orange-300">{children}</div>
}

function HighlightCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="p-3 bg-[#252525] rounded-lg border border-[#404040] hover:border-orange-500/50 transition">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <div className="font-semibold text-white text-sm">{title}</div>
      </div>
      <div className="text-xs text-slate-400">{desc}</div>
    </div>
  )
}

function FixItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-slate-300 flex items-start gap-2">
      {children}
    </div>
  )
}
