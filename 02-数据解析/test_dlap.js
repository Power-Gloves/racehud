/**
 * DLAP parser 自测：先 dump 解密后的内层文件结构 + JSON 元数据 + CSV 前几行，
 * 再走完整 parser 跑统计
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const { parseDlap, KEY, IV } = require('./dlap');

const samplePath = path.join(__dirname, '..', '01-数据样本', '超级马力卡丁车_2026_05_23_20_28_24.dlap');
const dumpDir = path.join(__dirname, 'dlap_dump');
fs.mkdirSync(dumpDir, { recursive: true });

(async () => {
    const buf = fs.readFileSync(samplePath);
    console.log(`输入: ${path.basename(samplePath)}  ${buf.length} 字节`);

    // === 1. 第一层：解开外层 ZIP ===
    const outer = await JSZip.loadAsync(buf);
    console.log(`\n[outer zip] ${Object.keys(outer.files).length} 个文件:`);
    for (const name of Object.keys(outer.files)) {
        console.log(`  - ${name}`);
    }
    const groupName = Object.keys(outer.files).find(n => n.endsWith('.group'));
    const groupCipher = await outer.files[groupName].async('nodebuffer');
    console.log(`  → ${groupName}: ${groupCipher.length} 字节（加密）`);

    // === 2. AES-128-CBC 解密 ===
    console.log(`\n[decrypt] AES-128-CBC`);
    console.log(`  key (hex): ${KEY.toString('hex')}`);
    console.log(`  iv  (hex): ${IV.toString('hex')}`);
    const decipher = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
    const plain = Buffer.concat([decipher.update(groupCipher), decipher.final()]);
    console.log(`  → 解密后: ${plain.length} 字节`);
    console.log(`  前 4 字节: ${plain.slice(0, 4).toString('hex')} (应该是 504B0304 = ZIP)`);

    // === 3. 第二层：解开内层 ZIP ===
    const inner = await JSZip.loadAsync(plain);
    console.log(`\n[inner zip] ${Object.keys(inner.files).length} 个文件:`);
    for (const name of Object.keys(inner.files)) {
        const f = inner.files[name];
        if (f.dir) continue;
        const data = await f.async('nodebuffer');
        const ext = name.split('.').pop().toLowerCase();
        const outPath = path.join(dumpDir, name.replace(/[\\/]/g, '_'));
        fs.writeFileSync(outPath, data);
        console.log(`  - ${name}  ${data.length} B  →  ${path.relative(__dirname, outPath)}`);

        // 文本类预览前 500 字符
        if (ext === 'json' || ext === 'csv' || ext === 'txt' || ext === 'cir') {
            const text = data.toString('utf8');
            const preview = text.slice(0, 500);
            console.log(`    --- 预览 ${ext} ---`);
            console.log('    ' + preview.replace(/\n/g, '\n    '));
            console.log(`    --- (共 ${text.length} 字符, ${text.split('\n').length} 行) ---`);
        }
    }

    // === 4. 走完整 parser ===
    console.log(`\n[parse]`);
    const result = await parseDlap(buf);
    const { meta, samples } = result;
    console.log(`  来源:     ${meta.source} (${meta.model})`);
    console.log(`  采样率:   ${meta.sampleRate} Hz`);
    console.log(`  采样点数: ${meta.count}`);
    console.log(`  起始时间: ${new Date(meta.startTime).toLocaleString('zh-CN', { hour12: false })}`);
    console.log(`  结束时间: ${new Date(meta.endTime).toLocaleString('zh-CN', { hour12: false })}`);
    console.log(`  时长:     ${(meta.duration / 60000).toFixed(2)} 分钟`);

    console.log(`\n  前 3 条原始 sample:`);
    samples.slice(0, 3).forEach(s => console.log('   ', JSON.stringify(s)));
    console.log(`\n  中间 1 条:`);
    console.log('   ', JSON.stringify(samples[Math.floor(samples.length / 2)]));
    console.log(`\n  最后 1 条:`);
    console.log('   ', JSON.stringify(samples[samples.length - 1]));

    // 通道统计
    console.log(`\n[stats]`);
    const stat = key => {
        const vals = samples.map(s => s[key]).filter(v => Number.isFinite(v));
        return {
            min: Math.min(...vals),
            max: Math.max(...vals),
            avg: vals.reduce((a, b) => a + b, 0) / vals.length,
        };
    };
    const fmt = (k, u, p = 2) => {
        const { min, max, avg } = stat(k);
        console.log(`  ${k.padEnd(14)} min=${min.toFixed(p).padStart(10)}${u}  max=${max.toFixed(p).padStart(10)}${u}  avg=${avg.toFixed(p).padStart(10)}${u}`);
    };
    fmt('speed', '');
    fmt('heading', ' °', 1);
    fmt('altitude', ' m', 1);
    fmt('acceleration', ' m/s²');
    fmt('gLong', ' G');
    fmt('gLat', ' G');
    console.log(`  distance       total=${(samples[samples.length - 1].distance / 1000).toFixed(3)} km`);
})().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
