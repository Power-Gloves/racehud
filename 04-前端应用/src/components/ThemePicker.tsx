import { useEffect, useRef } from 'react';
import { THEMES, type Theme } from '../themes';
import { loadHudFonts } from '../themes/fonts';
import { previewFrame } from '../themes/studio/preview';
const descriptions: Record<string, string> = {
    minimal: '克制透明 · 原版保留', apex: '转播记分牌 · 朱红切角', chrono: '中央仪表 · 冷银刻度', roadbook: '纵向路书 · 琥珀导航', endurance: '底部数据带 · 工程蓝', slipstream: '开放排版 · 酸柠绿', heritage: '复古计时 · 奶油暗红', custom: '设计师原版 · 完整信息', 'custom-no-lap': '设计师原版 · 清爽模式',
};
function Thumbnail({ theme }: {
    theme: Theme;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        let active = true;
        const draw = () => {
            if (!active)
                return;
            const c = ref.current?.getContext('2d');
            if (!c)
                return;
            c.save();
            c.clearRect(0, 0, 480, 270);
            c.scale(.25, .25);
            const bg = c.createLinearGradient(0, 0, 0, 1080);
            bg.addColorStop(0, '#303d43');
            bg.addColorStop(1, '#11191b');
            c.fillStyle = bg;
            c.fillRect(0, 0, 1920, 1080);
            c.beginPath();
            c.moveTo(740, 380);
            c.lineTo(1180, 380);
            c.lineTo(1770, 1080);
            c.lineTo(150, 1080);
            c.fillStyle = '#465055';
            c.fill();
            c.strokeStyle = '#84908e';
            c.lineWidth = 5;
            c.beginPath();
            c.moveTo(740, 380);
            c.lineTo(150, 1080);
            c.moveTo(1180, 380);
            c.lineTo(1770, 1080);
            c.stroke();
            if (theme.id.startsWith('custom')) {
                // DSK 原版带历史缓存，不能为缩略图调用它并污染真实播放状态。
                c.fillStyle = '#111c';
                c.fillRect(65, 65, 390, 240);
                c.fillRect(65, 805, 260, 200);
                c.fillRect(1480, 800, 365, 200);
                c.fillStyle = theme.preview.accent;
                c.font = '600 86px "Race Condensed"';
                c.fillText('84', 95, 957);
                c.fillStyle = '#fff';
                c.font = '600 38px "Race Mono"';
                c.fillText('01:28.361', 90, 156);
                c.fillText('DSK', 1530, 920);
                c.strokeStyle = theme.preview.accent;
                c.lineWidth = 7;
                c.beginPath();
                c.ellipse(1725, 185, 90, 65, -.2, 0, Math.PI * 2);
                c.stroke();
            }
            else
                theme.drawHud(c, previewFrame);
            c.restore();
        };
        draw();
        loadHudFonts().then(draw).catch(() => { });
        return () => { active = false; };
    }, [theme]);
    return <div className="relative"><canvas ref={ref} width={480} height={270} className="w-full aspect-video rounded" aria-hidden="true"/>{theme.id.startsWith('custom') && <span className="absolute right-1 top-1 text-[8px] text-slate-400">布局示意</span>}</div>;
}
export default function ThemePicker({ themeId, onChange }: {
    themeId: string;
    onChange: (id: string) => void;
}) {
    return <div className="grid grid-cols-2 gap-2" role="group" aria-label="HUD 主题">
    {THEMES.map(t => <button key={t.id} type="button" aria-pressed={t.id === themeId} onClick={() => onChange(t.id)} title={t.name} className={`rounded-lg border p-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 ${t.id === themeId ? 'border-orange-400 bg-orange-400/10' : 'border-white/10 bg-black/20 hover:border-white/35'}`}>
      <Thumbnail theme={t}/>
      <div className="mt-1.5 flex items-center justify-between gap-1 px-0.5"><span className="text-xs font-semibold text-white truncate">{t.name}</span><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.preview.accent }}/></div>
      <p className="mt-0.5 px-0.5 text-[10px] leading-4 text-slate-400 truncate">{descriptions[t.id]}</p>
    </button>)}
  </div>;
}
