import type { HudFrame } from '../types';
import type { Sample } from '../../types';
export const ink = '#10171d';
export const white = '#f4f5ed';
export const condensed = '"Race Condensed", sans-serif';
export const mono = '"Race Mono", monospace';
export const serif = '"Race Serif", Georgia, serif';
export function text(c: CanvasRenderingContext2D, value: string, x: number, y: number, size = 24, color = white, family = condensed, align: CanvasTextAlign = 'left') {
    c.save();
    c.font = `600 ${size}px ${family}`;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.fillStyle = color;
    c.fillText(value, x, y);
    c.restore();
}
export function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string | CanvasGradient = ink) { c.fillStyle = color; c.fillRect(x, y, w, h); }
export function line(c: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number, color = white, width = 2) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
}
export function time(seconds: number | undefined) {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0)
        return '--:--.---';
    const ms = Math.round(seconds * 1000);
    return `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}.${(ms % 1000).toString().padStart(3, '0')}`;
}
export function values(f: HudFrame) {
    const s = f.current;
    const valid = (n: number | undefined) => n != null && Number.isFinite(n);
    return {
        speed: valid(s?.speed) ? Math.round(Math.max(0, s!.speed) * (f.unit === 'mph' ? 0.621371 : 1)).toString() : '—',
        unit: f.unit === 'mph' ? 'MPH' : 'KM/H',
        lap: f.currentLap ? String(f.currentLap.lapNum).padStart(2, '0') : '—',
        elapsed: time(f.currentLap ? Math.max(0, Math.min(f.playheadT, f.currentLap.endT) - f.currentLap.startT) / 1000 : undefined),
        best: time(f.bestLap?.lapTime),
        delta: valid(s?.bestCompare) ? `${s!.bestCompare! >= 0 ? '+' : '−'}${Math.abs(s!.bestCompare!).toFixed(3)}` : '—',
        deltaColor: valid(s?.bestCompare) ? (s!.bestCompare! <= 0 ? '#b8eb8c' : '#ffb18e') : '#aeb7bc',
    };
}
export function design(c: CanvasRenderingContext2D, f: HudFrame, draw: () => void) {
    c.save();
    c.scale(f.width / 1920, f.height / 1080);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    draw();
    c.restore();
}
// 一次建立轨迹，播放时只变换路径与车点，避免逐帧遍历整场 GPS。
const paths = new WeakMap<Sample[], {
    path: Path2D;
    minX: number;
    minY: number;
    spanX: number;
    spanY: number;
    cos: number;
}>();
export function map(c: CanvasRenderingContext2D, f: HudFrame, x: number, y: number, w: number, h: number, color = white) {
    let cached = paths.get(f.samples);
    if (!cached) {
        const points = f.samples.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180);
        if (!points.length)
            return;
        const cos = Math.max(.001, Math.cos(points[0].lat * Math.PI / 180));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.lng * cos);
            maxX = Math.max(maxX, p.lng * cos);
            minY = Math.min(minY, -p.lat);
            maxY = Math.max(maxY, -p.lat);
        }
        const path = new Path2D();
        points.forEach((p, i) => i ? path.lineTo(p.lng * cos - minX, -p.lat - minY) : path.moveTo(p.lng * cos - minX, -p.lat - minY));
        cached = { path, minX, minY, spanX: maxX - minX, spanY: maxY - minY, cos };
        paths.set(f.samples, cached);
    }
    const k = Math.min(w / Math.max(cached.spanX, .00001), h / Math.max(cached.spanY, .00001));
    const ox = x + (w - cached.spanX * k) / 2, oy = y + (h - cached.spanY * k) / 2;
    c.save();
    c.translate(ox, oy);
    c.scale(k, k);
    c.strokeStyle = '#10171dcc';
    c.lineWidth = 10 / k;
    c.stroke(cached.path);
    c.strokeStyle = color;
    c.lineWidth = 4 / k;
    c.stroke(cached.path);
    c.restore();
    if (f.finishLine) {
        const { a, b } = f.finishLine;
        if ([a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) {
            const ax = ox + (a.lng * cached.cos - cached.minX) * k, ay = oy + (-a.lat - cached.minY) * k;
            const bx = ox + (b.lng * cached.cos - cached.minX) * k, by = oy + (-b.lat - cached.minY) * k;
            line(c, ax, ay, bx, by, ink, 6);
            line(c, ax, ay, bx, by, color, 2);
        }
    }
    const p = f.current;
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        c.beginPath();
        c.arc(ox + (p.lng * cached.cos - cached.minX) * k, oy + (-p.lat - cached.minY) * k, 7, 0, Math.PI * 2);
        c.fillStyle = color;
        c.fill();
        c.strokeStyle = ink;
        c.lineWidth = 3;
        c.stroke();
    }
}
export function gforce(c: CanvasRenderingContext2D, f: HudFrame, x: number, y: number, r: number, color = white) {
    c.save();
    c.beginPath();
    c.arc(x, y, r + 5, 0, Math.PI * 2);
    c.fillStyle = '#10171d80';
    c.fill();
    c.strokeStyle = color;
    c.globalAlpha = .5;
    c.lineWidth = 1.5;
    for (const radius of [r / 2, r]) {
        c.beginPath();
        c.arc(x, y, radius, 0, Math.PI * 2);
        c.stroke();
    }
    line(c, x - r, y, x + r, y, color, 1);
    line(c, x, y - r, x, y + r, color, 1);
    c.globalAlpha = 1;
    const clamp = (n: number) => Number.isFinite(n) ? Math.max(-2, Math.min(2, n)) : 0;
    if (f.current && Number.isFinite(f.current.gLat) && Number.isFinite(f.current.gLong)) {
        const gx = clamp(f.current.gLat), gy = clamp(f.current.gLong);
        const length = Math.max(2, Math.hypot(gx, gy));
        c.beginPath();
        c.arc(x + gx / length * r, y - gy / length * r, 6, 0, Math.PI * 2);
        c.fillStyle = color;
        c.fill();
    }
    c.restore();
}
export function dial(c: CanvasRenderingContext2D, f: HudFrame, x: number, y: number, r: number, color = white, classic = false) {
    c.save();
    c.beginPath();
    c.arc(x, y, r + 12, 0, Math.PI * 2);
    c.fillStyle = classic ? '#efe7d9f2' : '#131c23ed';
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.stroke();
    const max = f.unit === 'mph' ? 100 : 160;
    for (let i = 0; i <= 32; i++) {
        const a = (135 + i * 270 / 32) * Math.PI / 180;
        const major = i % 4 === 0;
        line(c, x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8), x + Math.cos(a) * (r - (major ? 24 : 15)), y + Math.sin(a) * (r - (major ? 24 : 15)), color, major ? 3 : 1);
        if (major)
            text(c, String(i / 32 * max), x + Math.cos(a) * (r - 43), y + Math.sin(a) * (r - 43) + 6, 18, color, mono, 'center');
    }
    const v = values(f), numeric = Number(v.speed);
    if (Number.isFinite(numeric)) {
        const a = (135 + Math.max(0, Math.min(1, numeric / max)) * 270) * Math.PI / 180;
        line(c, x, y, x + Math.cos(a) * (r - 30), y + Math.sin(a) * (r - 30), classic ? '#a32d29' : '#fc754f', 4);
    }
    c.beginPath();
    c.arc(x, y, 7, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    text(c, v.speed, x, y + 57, 48, color, classic ? serif : condensed, 'center');
    text(c, v.unit, x, y + 80, 14, color, mono, 'center');
    c.restore();
}
export function trace(c: CanvasRenderingContext2D, f: HudFrame, x: number, y: number, w: number, h: number, color: string) {
    const a = f.samples;
    if (!a.length)
        return;
    let lo = 0, hi = a.length;
    while (lo < hi) {
        const m = (lo + hi) >>> 1;
        if (a[m].t < f.playheadT - 8000)
            lo = m + 1;
        else
            hi = m;
    }
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.beginPath();
    let started = false;
    for (let i = lo; i < a.length && a[i].t <= f.playheadT; i++) {
        const s = a[i];
        if (!Number.isFinite(s.speed))
            continue;
        const px = x + (s.t - f.playheadT + 8000) / 8000 * w, py = y + h - Math.min(160, Math.max(0, s.speed)) / 160 * h;
        if (started)
            c.lineTo(px, py);
        else {
            c.moveTo(px, py);
            started = true;
        }
    }
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.stroke();
    c.restore();
}
