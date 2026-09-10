import type { HudFrame } from '../types';
import type { Sample } from '../../types';
// 明确的演示数据，只用于主题缩略图，不参与用户遥测和导出。
const samples: Sample[] = Array.from({ length: 240 }, (_, i) => {
    const a = i / 239 * Math.PI * 2, radius = 1 + .2 * Math.sin(3 * a);
    return { t: i * 250, lat: 30 + .0012 * Math.sin(a) * radius, lng: 114 + .0018 * Math.cos(a) * radius, speed: 72 + 22 * Math.sin(a * 3), heading: 90, altitude: 0, sats: 12, acceleration: 0, gLong: .35, gLat: -.65, distance: i * 4, bestCompare: -.218 };
});
const lap = { lapNum: 3, startT: 0, endT: 59750, lapTime: 59.75, isBest: false, isCurrent: true };
export const previewFrame: HudFrame = {
    width: 1920, height: 1080, current: samples[170], samples,
    meta: { startTime: 0, endTime: 59750, duration: 59.75, model: '演示', source: 'preview', columns: [], sampleRate: 4, count: samples.length },
    playheadT: 42500, laps: [lap], currentLap: lap, bestLap: { ...lap, lapNum: 2, lapTime: 58.361, isBest: true, isCurrent: false },
};
