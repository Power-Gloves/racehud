/**
 * Dragy / RaceLogic VBO 文件解析器
 *
 * 输出统一数据模型：
 * {
 *   meta: { startTime: ms, model, source, columns, sampleRate },
 *   samples: [{ t, lat, lng, speed, heading, altitude, sats,
 *               acceleration, gLong, gLat, distance }]
 * }
 */

const fs = require('fs');

/**
 * 解析 VBO 文本内容
 * @param {string} text  VBO 文件全文
 * @returns {{meta: object, samples: object[]}}
 */
function parseVbo(text) {
    // 按 section 切分（[xxx] 行）
    const sections = {};
    let currentSection = null;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const m = line.match(/^\[(.+?)\]$/);
        if (m) {
            currentSection = m[1].toLowerCase();
            sections[currentSection] = [];
        } else if (currentSection) {
            sections[currentSection].push(rawLine);
        }
    }

    if (!sections['data']) throw new Error('VBO 缺少 [data] 段');
    if (!sections['column names']) throw new Error('VBO 缺少 [column names] 段');

    const columns = sections['column names'][0].trim().split(/\s+/);

    // 从 [comments] 解析 UTC 起始日期
    let startDateUtc = null;
    let model = 'unknown';
    let source = 'dragy';
    if (sections['comments']) {
        for (const line of sections['comments']) {
            const dateMatch = line.match(/UTC Date Started:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})/);
            if (dateMatch) {
                const [, dd, mm, yyyy, hh, mi] = dateMatch;
                startDateUtc = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, 0);
            }
            const modelMatch = line.match(/Model:\s*(.+)/);
            if (modelMatch) model = modelMatch[1].trim();
            if (/dragy/i.test(line)) source = 'dragy';
        }
    }

    // 解析数据行
    const idx = {
        sats: columns.indexOf('sats'),
        time: columns.indexOf('time'),
        lat: columns.indexOf('lat'),
        lng: columns.indexOf('long'),
        speed: columns.indexOf('velocity'),
        heading: columns.indexOf('heading'),
        height: columns.indexOf('height'),
    };

    const raw = [];
    for (const line of sections['data']) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < columns.length) continue;

        const timeStr = parts[idx.time];                   // "HHMMSS.fff"
        const t = parseVboTime(timeStr, startDateUtc);
        if (t === null) continue;

        // arc-minute → degree
        const latMin = parseFloat(parts[idx.lat]);
        const lngMin = parseFloat(parts[idx.lng]);
        const lat = latMin / 60;
        // VBO 标准：west = positive，所以经度需要取反才能匹配常规 +东 -西
        const lng = -lngMin / 60;

        raw.push({
            t,
            lat,
            lng,
            speed: parseFloat(parts[idx.speed]),         // km/h
            heading: parseFloat(parts[idx.heading]),
            altitude: parseFloat(parts[idx.height]),
            sats: parseInt(parts[idx.sats], 10),
        });
    }

    if (raw.length < 2) throw new Error('VBO 数据点不足');

    // 推算采样率
    const dt = raw[1].t - raw[0].t;
    const sampleRate = dt > 0 ? Math.round(1000 / dt) : 0;

    // 派生通道：加速度、纵向 G、累计距离
    enrichSamples(raw);

    return {
        meta: {
            startTime: raw[0].t,
            endTime: raw[raw.length - 1].t,
            duration: raw[raw.length - 1].t - raw[0].t,
            model,
            source,
            columns,
            sampleRate,
            count: raw.length,
        },
        samples: raw,
    };
}

/**
 * 解析 VBO time 字段：HHMMSS.fff（UTC，无日期）
 * @returns {number|null} 绝对 UTC ms 时间戳
 */
function parseVboTime(s, baseDateUtc) {
    // 例：122824.900 → 12:28:24.900
    const m = s.match(/^(\d{2})(\d{2})(\d{2})(?:\.(\d+))?$/);
    if (!m) return null;
    const [, hh, mm, ss, frac] = m;
    const ms = frac ? parseInt((frac + '000').slice(0, 3), 10) : 0;
    const dayMs = (+hh) * 3600000 + (+mm) * 60000 + (+ss) * 1000 + ms;
    if (baseDateUtc !== null) {
        // baseDateUtc 已含小时分钟，但只精确到分。
        // 用 baseDateUtc 取年月日，再加上当天的 dayMs。
        const date = new Date(baseDateUtc);
        const y = date.getUTCFullYear();
        const mo = date.getUTCMonth();
        const d = date.getUTCDate();
        return Date.UTC(y, mo, d, 0, 0, 0) + dayMs;
    }
    return dayMs;
}

/**
 * 给 samples 补上派生通道：acceleration / gLong / gLat / distance
 */
function enrichSamples(samples) {
    const G = 9.80665;
    let totalDist = 0;

    for (let i = 0; i < samples.length; i++) {
        const cur = samples[i];

        if (i > 0) {
            const prev = samples[i - 1];
            // 距离：haversine
            const d = haversine(prev.lat, prev.lng, cur.lat, cur.lng);
            totalDist += d;

            // 时间差秒
            const dt = (cur.t - prev.t) / 1000;
            // 速度差 m/s
            const dv = (cur.speed - prev.speed) / 3.6;
            cur.acceleration = dt > 0 ? dv / dt : 0;
            cur.gLong = cur.acceleration / G;

            // 侧向 G：基于 heading 变化率和速度
            // 角速度 ω (rad/s) = Δheading / dt
            const dh = angleDelta(prev.heading, cur.heading) * Math.PI / 180;
            const omega = dt > 0 ? dh / dt : 0;
            const v = cur.speed / 3.6; // m/s
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

/**
 * 计算两个角度之间的最短差值，返回 (-180, 180]
 */
function angleDelta(a, b) {
    let d = b - a;
    while (d > 180) d -= 360;
    while (d <= -180) d += 360;
    return d;
}

/**
 * 从文件路径解析
 */
function parseVboFile(filepath) {
    const text = fs.readFileSync(filepath, 'utf8');
    return parseVbo(text);
}

module.exports = { parseVbo, parseVboFile };
