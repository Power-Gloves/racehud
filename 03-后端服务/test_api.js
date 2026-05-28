/**
 * API 集成测试：验证 /api/parse-vbo 和 /api/parse-dlap
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_DIR = path.join(__dirname, '..', '01-数据样本');
const VBO = path.join(SAMPLE_DIR, 'dragylap_20260523_202824_超级马力卡丁车.vbo');
const DLAP = path.join(SAMPLE_DIR, '超级马力卡丁车_2026_05_23_20_28_24.dlap');

async function uploadAndParse(filepath, endpoint, label) {
    const buf = fs.readFileSync(filepath);
    const blob = new Blob([buf]);
    const form = new FormData();
    form.append('file', blob, path.basename(filepath));
    const t0 = Date.now();
    const res = await fetch(`http://localhost:4001${endpoint}`, { method: 'POST', body: form });
    const dt = Date.now() - t0;
    if (!res.ok) {
        console.log(`${label} FAIL: ${res.status}`);
        console.log(await res.text());
        return null;
    }
    const data = await res.json();
    console.log(`${label}: ${res.status} (${dt}ms, ${(buf.length / 1024).toFixed(0)}KB → ${(JSON.stringify(data).length / 1024).toFixed(0)}KB)`);
    console.log(`  采样点: ${data.meta.count}  采样率: ${data.meta.sampleRate}Hz  时长: ${(data.meta.duration / 60000).toFixed(2)} 分钟`);
    console.log(`  来源:   ${data.meta.source}  设备: ${data.meta.model}`);
    const s0 = data.samples[0];
    const sm = data.samples[Math.floor(data.samples.length / 2)];
    console.log(`  首条:   v=${s0.speed.toFixed(1)}km/h pos=${s0.lat.toFixed(4)},${s0.lng.toFixed(4)} hdg=${s0.heading.toFixed(0)}°`);
    console.log(`  中间:   v=${sm.speed.toFixed(1)}km/h hdg=${sm.heading.toFixed(0)}° gLat=${sm.gLat?.toFixed(2)}G${sm.lapNum != null ? ` lap=${sm.lapNum}` : ''}`);
    return data;
}

(async () => {
    const health = await fetch('http://localhost:4001/api/health');
    console.log(`/api/health: ${health.status} ${(await health.json()).ok ? 'OK' : 'FAIL'}\n`);

    await uploadAndParse(VBO, '/api/parse-vbo', '/api/parse-vbo');
    console.log();
    await uploadAndParse(DLAP, '/api/parse-dlap', '/api/parse-dlap');
    console.log();
    await uploadAndParse(VBO, '/api/parse-telemetry', '/api/parse-telemetry (vbo)');
    console.log();
    await uploadAndParse(DLAP, '/api/parse-telemetry', '/api/parse-telemetry (dlap)');
})().catch(e => { console.error(e); process.exit(1); });
