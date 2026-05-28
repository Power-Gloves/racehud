/**
 * racehud 后端服务
 * - 上传 VBO 解析为统一数据模型
 * - 上传视频，FFprobe 拿元信息
 * - 后续：FFmpeg 渲染管线
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { parseVbo } = require('../02-数据解析/vbo');
const { parseDlap } = require('../02-数据解析/dlap');

const PORT = 4001;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 文件上传：保留原始扩展名
const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
        const ts = Date.now();
        const safe = Buffer.from(file.originalname, 'latin1').toString('utf8')
            .replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
        cb(null, `${ts}_${safe}`);
    },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: Date.now() });
});

// ============ VBO 解析 ============
/**
 * POST /api/parse-vbo
 * - 接收 multipart 文件字段 `file`，或 JSON body { text }
 * - 返回 { meta, samples }
 */
app.post('/api/parse-vbo', upload.single('file'), (req, res) => {
    try {
        let text;
        if (req.file) {
            text = fs.readFileSync(req.file.path, 'utf8');
        } else if (req.body && req.body.text) {
            text = req.body.text;
        } else {
            return res.status(400).json({ error: '需要上传文件或提供 text 字段' });
        }
        const result = parseVbo(text);
        res.json(result);
    } catch (err) {
        console.error('parse-vbo error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============ DLAP 解析 ============
/**
 * POST /api/parse-dlap
 * - multipart 字段 `file`，必须是 *.dlap
 * - 返回 { meta, samples, raw }
 */
app.post('/api/parse-dlap', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: '需要上传 .dlap 文件' });
        const buf = fs.readFileSync(req.file.path);
        const result = await parseDlap(buf);
        // raw.jsonMeta 里有原始 JSON，前端通常不需要全量
        // 这里精简一下避免响应体过大
        const slim = {
            meta: result.meta,
            samples: result.samples,
            raw: { innerFiles: result.raw.innerFiles },
        };
        res.json(slim);
    } catch (err) {
        console.error('parse-dlap error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============ 自动识别格式 ============
/**
 * POST /api/parse-telemetry
 * 根据扩展名自动派发到 vbo / dlap parser
 */
app.post('/api/parse-telemetry', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: '需要上传 .vbo 或 .dlap 文件' });
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (ext === '.vbo') {
            const text = fs.readFileSync(req.file.path, 'utf8');
            res.json(parseVbo(text));
        } else if (ext === '.dlap') {
            const buf = fs.readFileSync(req.file.path);
            const result = await parseDlap(buf);
            res.json({
                meta: result.meta,
                samples: result.samples,
                raw: { innerFiles: result.raw.innerFiles },
            });
        } else {
            res.status(400).json({ error: `不支持的扩展名: ${ext}` });
        }
    } catch (err) {
        console.error('parse-telemetry error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============ 视频上传（占位：先返回路径，后续接 ffprobe）============
app.post('/api/upload-video', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '缺少 file' });
    res.json({
        filename: req.file.filename,
        size: req.file.size,
        path: `/uploads/${req.file.filename}`,
    });
});

// 静态访问已上传文件（开发期方便预览）
app.use('/uploads', express.static(UPLOAD_DIR));

// 部署时静态托管前端 build 产物
const WEB_DIST = path.join(__dirname, '..', '04-前端应用', 'dist');
if (fs.existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
}

app.listen(PORT, () => {
    console.log(`racehud 后端启动: http://localhost:${PORT}`);
    console.log(`上传目录: ${UPLOAD_DIR}`);
});
