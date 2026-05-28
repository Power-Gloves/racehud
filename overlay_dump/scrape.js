// 爬 laptimer.com/overlay,抓所有动态加载的 chunk
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://laptimer.com/overlay';
const OUT_DIR = path.resolve(__dirname);
const CHUNKS_DIR = path.join(OUT_DIR, 'chunks');
fs.mkdirSync(CHUNKS_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const requests = [];
  page.on('request', (req) => {
    requests.push({ url: req.url(), method: req.method(), type: req.resourceType() });
  });

  // 把所有 script 资源直接保存
  const savedJs = new Map();
  page.on('response', async (res) => {
    try {
      const url = res.url();
      const type = res.request().resourceType();
      if (type !== 'script' && type !== 'xhr' && type !== 'fetch') return;
      if (savedJs.has(url)) return;
      const status = res.status();
      if (status >= 400) return;
      const body = await res.body().catch(() => null);
      if (!body) return;
      // 路径名:取 URL pathname,把 / 变 _,避免重名
      const u = new URL(url);
      if (u.host !== 'laptimer.com' && u.host !== 'www.laptimer.com') return;
      const safeName = u.pathname.replace(/^\//, '').replace(/[\/\\]/g, '_') || 'root';
      const fname = path.join(CHUNKS_DIR, safeName);
      fs.writeFileSync(fname, body);
      savedJs.set(url, { fname, size: body.length, type });
      console.log(`[saved] ${type.padEnd(6)} ${u.pathname} -> ${body.length}B`);
    } catch (e) {
      // ignore
    }
  });

  console.log(`[goto] ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
  // 给 SPA 一点时间触发 import()
  await page.waitForTimeout(3000);

  // 检查页面里所有 <script> 标签和 link modulepreload
  const scriptTags = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.src);
    const preloads = [...document.querySelectorAll('link[rel="modulepreload"]')].map((l) => l.href);
    return { scripts, preloads };
  });

  // 试着触发更多 chunk:在页面里搜 .js 字符串引用
  const jsRefsInBundle = await page.evaluate(async () => {
    // 从所有已加载的 script 里 fetch 一遍它们的源码,正则找 .js 路径
    const out = new Set();
    for (const s of document.querySelectorAll('script[src]')) {
      try {
        const txt = await fetch(s.src).then((r) => r.text());
        const matches = txt.match(/["'`]([\/\w\-\.@]*\/[\w\-]+\.js)["'`]/g) || [];
        matches.forEach((m) => out.add(m.replace(/["'`]/g, '')));
        // 找 detector / prepare / worker 等关键词附近的字符串
        for (const kw of ['detector', 'prepare', 'worker', 'wasm']) {
          const re = new RegExp(`["'\`]([^"'\`]*${kw}[^"'\`]*)["'\`]`, 'gi');
          let m;
          while ((m = re.exec(txt)) !== null) out.add(`[kw:${kw}] ${m[1]}`);
        }
      } catch {}
    }
    return [...out];
  });

  await browser.close();

  const summary = {
    target: TARGET_URL,
    requestCount: requests.length,
    requests,
    savedFiles: [...savedJs.entries()].map(([url, v]) => ({ url, ...v })),
    scriptTags,
    jsRefsInBundle,
  };
  const summaryPath = path.join(OUT_DIR, 'scrape-result.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n[done] saved ${savedJs.size} files`);
  console.log(`[done] summary -> ${summaryPath}`);

  // 关键词命中筛选
  const interesting = jsRefsInBundle.filter((r) =>
    /detector|prepare|worker|wasm/i.test(r),
  );
  console.log(`\n[matches]`);
  interesting.forEach((r) => console.log('  ' + r));
})();
