/**
 * VBO parser 自测：解析样本，输出关键统计与前后几条记录
 */
const path = require('path');
const { parseVboFile } = require('./vbo');

const samplePath = path.join(__dirname, '..', '01-数据样本', 'dragylap_20260523_202824_超级马力卡丁车.vbo');

const result = parseVboFile(samplePath);
const { meta, samples } = result;

console.log('========== 元数据 ==========');
console.log(`来源:       ${meta.source} (${meta.model})`);
console.log(`采样率:     ${meta.sampleRate} Hz`);
console.log(`采样点数:   ${meta.count}`);
console.log(`起始时间:   ${new Date(meta.startTime).toLocaleString('zh-CN', { hour12: false })}`);
console.log(`结束时间:   ${new Date(meta.endTime).toLocaleString('zh-CN', { hour12: false })}`);
console.log(`时长:       ${(meta.duration / 1000).toFixed(1)} 秒 (${(meta.duration / 60000).toFixed(2)} 分钟)`);
console.log(`原始字段:   ${meta.columns.join(', ')}`);

console.log('\n========== 前 3 条 ==========');
samples.slice(0, 3).forEach(s => printSample(s));

console.log('\n========== 中间 3 条 ==========');
const mid = Math.floor(samples.length / 2);
samples.slice(mid, mid + 3).forEach(s => printSample(s));

console.log('\n========== 后 3 条 ==========');
samples.slice(-3).forEach(s => printSample(s));

console.log('\n========== 通道统计 ==========');
const stats = (key) => {
    const vals = samples.map(s => s[key]).filter(v => Number.isFinite(v));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, avg };
};
const fmt = (s, key, unit, prec = 2) => {
    const { min, max, avg } = stats(key);
    console.log(`${key.padEnd(14)} min=${min.toFixed(prec).padStart(8)}${unit}  max=${max.toFixed(prec).padStart(8)}${unit}  avg=${avg.toFixed(prec).padStart(8)}${unit}`);
};
fmt(samples, 'speed', ' km/h');
fmt(samples, 'heading', ' deg', 1);
fmt(samples, 'altitude', ' m', 1);
fmt(samples, 'acceleration', ' m/s²');
fmt(samples, 'gLong', ' G');
fmt(samples, 'gLat', ' G');
console.log(`distance       total=${(samples[samples.length - 1].distance / 1000).toFixed(3)} km`);

const latMin = Math.min(...samples.map(s => s.lat));
const latMax = Math.max(...samples.map(s => s.lat));
const lngMin = Math.min(...samples.map(s => s.lng));
const lngMax = Math.max(...samples.map(s => s.lng));
console.log(`\n经纬度范围:   lat ${latMin.toFixed(6)} ~ ${latMax.toFixed(6)}`);
console.log(`              lng ${lngMin.toFixed(6)} ~ ${lngMax.toFixed(6)}`);

function printSample(s) {
    const t = new Date(s.t).toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(s.t % 1000).padStart(3, '0');
    console.log(
        `[${t}] ` +
        `pos=${s.lat.toFixed(6)},${s.lng.toFixed(6)} ` +
        `v=${s.speed.toFixed(1).padStart(5)}km/h ` +
        `hdg=${s.heading.toFixed(1).padStart(5)}° ` +
        `alt=${s.altitude.toFixed(1)}m ` +
        `gL=${s.gLong.toFixed(2)} gT=${s.gLat.toFixed(2)} ` +
        `d=${s.distance.toFixed(1)}m`
    );
}
