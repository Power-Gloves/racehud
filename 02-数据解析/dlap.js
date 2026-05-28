/**
 * Dragy DLAP 文件解析器
 *
 * 文件结构：
 *   *.dlap (ZIP)
 *     └── *.group   AES-128-CBC 加密的字节流
 *           解密后还是一个 ZIP：
 *             ├── *.json   元数据 (laps / weatherInfo / dataInfoFile 路径等)
 *             ├── *.csv    主数据
 *             ├── *.cir / *.txt
 *             └── *.png    封面/图标
 *
 * 解密参数（从 laptimer.com bundle 反查得到）：
 *   key = "i2FleZnd" + \0 × 8  (16 字节)
 *   iv  = "i3ev8len" + \0 × 8  (16 字节)
 *   alg = AES-128-CBC + PKCS7 padding
 *
 * 输出统一 Sample 模型，与 vbo.js 对齐
 */

const fs = require('fs');
const crypto = require('crypto');
const JSZip = require('jszip');

const KEY = Buffer.concat([Buffer.from('i2FleZnd', 'utf8'), Buffer.alloc(8)]);
const IV = Buffer.concat([Buffer.from('i3ev8len', 'utf8'), Buffer.alloc(8)]);

/**
 * 解密 .group 文件字节流
 */
function decryptGroup(encryptedBytes) {
    const decipher = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
    return Buffer.concat([decipher.update(encryptedBytes), decipher.final()]);
}

/**
 * 解析 DLAP 文件 buffer
 * @param {Buffer} dlapBuffer
 * @returns {Promise<{meta, samples, raw}>}
 */
async function parseDlap(dlapBuffer) {
    // 第一层：解开 .dlap 这个 ZIP，找出唯一的 .group 文件
    const outerZip = await JSZip.loadAsync(dlapBuffer);
    const groupName = Object.keys(outerZip.files).find(n => n.endsWith('.group'));
    if (!groupName) throw new Error('DLAP 内未找到 .group 文件');
    const groupCipher = await outerZip.files[groupName].async('nodebuffer');

    // AES 解密
    const groupPlain = decryptGroup(groupCipher);

    // 第二层：解密后又是一个 ZIP
    const innerZip = await JSZip.loadAsync(groupPlain);

    // 列出内层文件
    const inner = {};
    for (const name of Object.keys(innerZip.files)) {
        const f = innerZip.files[name];
        if (f.dir) continue;
        const ext = name.split('.').pop().toLowerCase();
        inner[name] = { ext, file: f };
    }

    // 找主数据（.cir 是 CSV 文本，扩展名是 Dragy 自定义）和 .json 元数据
    const dataEntry = Object.entries(inner).find(([, v]) => v.ext === 'cir' || v.ext === 'csv');
    const jsonEntry = Object.entries(inner).find(([, v]) => v.ext === 'json');
    if (!dataEntry) throw new Error('DLAP 解密后未找到 .cir / .csv 主数据');

    const csvText = await dataEntry[1].file.async('string');
    const jsonText = jsonEntry ? await jsonEntry[1].file.async('string') : null;
    const jsonMeta = jsonText ? safeJson(jsonText) : null;

    // 用 createTime 作为日期基准（毫秒），无则回退到当前
    const baseEpochMs = jsonMeta?.createTime
        ? Math.round(jsonMeta.createTime * (jsonMeta.createTime < 1e12 ? 1000 : 1))
        : Date.now();

    // 解析 CSV
    const samples = parseCsv(csvText, baseEpochMs);
    if (samples.length < 2) throw new Error('DLAP CSV 数据点不足');

    // 派生通道（与 vbo.js 一致）
    enrichSamples(samples);

    // 推算采样率
    const dt = samples[1].t - samples[0].t;
    const sampleRate = dt > 0 ? Math.round(1000 / dt) : 0;

    return {
        meta: {
            startTime: samples[0].t,
            endTime: samples[samples.length - 1].t,
            duration: samples[samples.length - 1].t - samples[0].t,
            model: jsonMeta?.deviceName || 'dragy',
            firmwareVersion: jsonMeta?.firmwareVersion?.replace(/\u0000/g, '') || null,
            source: 'dragy-dlap',
            columns: ['userTime', 'time', 'speed', 'acc', 'alt', 'lat', 'lng',
                'distance', 'accuracy', 'satelliteNum', 'heading',
                'brake', 'lastCompare', 'bestCompare', 'bestTime', 'idx'],
            sampleRate,
            count: samples.length,
            createTime: baseEpochMs,
        },
        samples,
        raw: {
            innerFiles: Object.keys(inner),
            jsonMeta,
        },
    };
}

/**
 * 从文件路径解析
 */
async function parseDlapFile(filepath) {
    const buf = fs.readFileSync(filepath);
    return parseDlap(buf);
}

/**
 * 解析 .cir / .csv 文本（无 header，逗号分隔）
 * 列顺序（来自 laptimer.com processLine）：
 *   userTime, time, speed, acc, alt, lat, lng, distance, accuracy,
 *   satelliteNum, heading, brake, lastCompare, bestCompare, bestTime, idx
 *
 * - userTime: 相对时间，秒（0 起步）
 * - time:     UTC 当天秒数（午夜起算），如 44902.90 = 12:28:22.90 UTC
 * - speed:    km/h
 * - lat/lng:  度（直接可用）
 * - alt:      m
 * - heading:  0-360 度
 *
 * @param {string} text       CSV 文本
 * @param {number} baseEpochMs 用于取年月日的基准（来自 json.createTime）
 */
function parseCsv(text, baseEpochMs) {
    const lines = text.split(/\r?\n/);

    // 取 baseEpochMs 对应的 UTC 当天 0 点
    const base = new Date(baseEpochMs);
    const dayStartUtc = Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate(),
        0, 0, 0
    );

    const samples = [];
    let firstUserTime = null;

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 11) continue;
        // 跳过非数字行（防御 header）
        if (!/^[-+\d.]/.test(parts[0])) continue;

        const userTime = parseFloat(parts[0]);          // 秒
        const timeUtcSec = parseFloat(parts[1]);        // UTC 当天秒数

        // 优先用 UTC 当天秒数（更精确，且与 VBO 起点一致）
        let t;
        if (Number.isFinite(timeUtcSec) && timeUtcSec > 0) {
            t = dayStartUtc + Math.round(timeUtcSec * 1000);
            // 跨日处理：如果算出来比 baseEpochMs 早超过 12 小时，加一天
            if (baseEpochMs - t > 12 * 3600 * 1000) t += 86400 * 1000;
            else if (t - baseEpochMs > 12 * 3600 * 1000) t -= 86400 * 1000;
        } else {
            // 回退用 userTime + base
            if (firstUserTime === null) firstUserTime = userTime;
            t = baseEpochMs + Math.round((userTime - firstUserTime) * 1000);
        }

        samples.push({
            t,
            lat: parseFloat(parts[5]),
            lng: parseFloat(parts[6]),
            speed: parseFloat(parts[2]),                // km/h
            heading: parseFloat(parts[10]) || 0,         // 多数 DLAP 这一列恒为 0，下方再补
            altitude: parseFloat(parts[4]),
            sats: parseInt(parts[9], 10) || 0,
            accuracy: parseFloat(parts[8]) || 0,
            brake: parseFloat(parts[11]) || 0,
            // 保留原始 acc 列（设备给的纵向加速度），后续可与派生值对照
            accRaw: parseFloat(parts[3]) || 0,
            distanceRaw: parseFloat(parts[7]) || 0,      // 本圈累计距离（米）
            // 圈分析（DLAP 独有）
            lapNum: parseInt(parts[15], 10) || 0,
            lapTimeInLap: userTime * 1000,               // 本圈已用时（毫秒）
            lastCompare: parseFloat(parts[12]) || 0,
            bestCompare: parseFloat(parts[13]) || 0,
            bestTime: parseFloat(parts[14]) || 0,
        });
    }
    return samples;
}

function safeJson(s) {
    try { return JSON.parse(s); } catch { return null; }
}

/**
 * 派生通道：distance / heading 兜底 / acceleration / gLong / gLat
 *
 * DLAP 的特点：原始 heading 列恒为 0，需要从经纬度推算
 */
function enrichSamples(samples) {
    if (samples.length < 2) return;
    const G = 9.80665;

    // 1. heading 兜底：DLAP 这一列恒为 0，从相邻点经纬度算方位角
    //    用 i-1 → i+1 的两点差分（中心差分）让结果更稳定
    const headingStd = stdDev(samples.map(s => s.heading || 0));
    const headingFromGps = headingStd < 1.0;
    if (headingFromGps) {
        for (let i = 0; i < samples.length; i++) {
            const a = samples[Math.max(0, i - 1)];
            const b = samples[Math.min(samples.length - 1, i + 1)];
            samples[i].heading = bearing(a.lat, a.lng, b.lat, b.lng);
        }
    }

    // 2. 累计距离 + 加速度 + 横纵 G
    let totalDist = 0;
    for (let i = 0; i < samples.length; i++) {
        const cur = samples[i];
        if (i > 0) {
            const prev = samples[i - 1];
            totalDist += haversine(prev.lat, prev.lng, cur.lat, cur.lng);
            const dt = (cur.t - prev.t) / 1000;
            const dv = (cur.speed - prev.speed) / 3.6;
            cur.acceleration = dt > 0 ? dv / dt : 0;
            cur.gLong = cur.acceleration / G;
            const dh = angleDelta(prev.heading, cur.heading) * Math.PI / 180;
            const omega = dt > 0 ? dh / dt : 0;
            const v = cur.speed / 3.6;
            cur.gLat = (v * omega) / G;
        } else {
            cur.acceleration = 0;
            cur.gLong = 0;
            cur.gLat = 0;
        }
        cur.distance = totalDist;
    }
}

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const dφ = (lat2 - lat1) * Math.PI / 180;
    const dλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 两点间方位角（0=北，顺时针 0-360） */
function bearing(lat1, lng1, lat2, lng2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function angleDelta(a, b) {
    let d = b - a;
    while (d > 180) d -= 360;
    while (d <= -180) d += 360;
    return d;
}

function stdDev(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}

module.exports = { parseDlap, parseDlapFile, decryptGroup, KEY, IV };
