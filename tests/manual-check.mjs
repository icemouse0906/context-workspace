// Opens a real browser with dist/ loaded for hands-on acceptance, then stays alive until the
// window is closed. Same isolation rules as the e2e script: temporary profile, local fixtures.
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';

const root = resolve(import.meta.dirname, '..');
const profile = await mkdtemp(join(tmpdir(), 'context-workspace-manual-'));
const fixtures = {
  '/jd': '百度 - AI 产品经理 JD',
  '/resume': '我的简历 · 在线文档',
  '/chat': 'AI 对话',
  '/novel': '第三卷 · 草稿',
  '/unrelated': '无关页面',
};
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const links = Object.entries(fixtures).map(([p, t]) => `<li><a href="${p}">${t}</a></li>`).join('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><meta charset="utf-8"><title>${fixtures[path] ?? '验收测试首页'}</title>
    <body style="font:16px/1.7 system-ui;max-width:620px;margin:60px auto;padding:0 20px">
    <h1>${fixtures[path] ?? '验收测试首页'}</h1>
    <p style="color:#647566">本地测试页面，不是真实网站。可以把它当作一个要保存进 Context 的网页。</p>
    <ul>${links}</ul>`);
});
await new Promise(ready => server.listen(0, '127.0.0.1', ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launchPersistentContext(profile, {
  ...(process.env.CW_BROWSER_EXECUTABLE ? { executablePath: process.env.CW_BROWSER_EXECUTABLE } : { channel: 'chromium' }),
  headless: false, viewport: null,
  args: [`--disable-extensions-except=${join(root, 'dist')}`, `--load-extension=${join(root, 'dist')}`],
});
let worker = browser.serviceWorkers()[0];
if (!worker) worker = await browser.waitForEvent('serviceworker');
const extensionId = new URL(worker.url()).hostname;
const page = browser.pages()[0] ?? await browser.newPage();
await page.goto(origin);
console.log(`扩展已加载，ID：${extensionId}`);
console.log(`本地测试网页：${origin}`);
console.log(`侧边栏地址（工具栏打不开时的备用入口）：chrome-extension://${extensionId}/index.html`);
console.log('临时配置：' + profile);
console.log('\n关闭浏览器窗口即自动清理临时配置并退出。');
browser.on('close', async () => {
  await new Promise(done => server.close(done));
  await rm(profile, { recursive: true, force: true });
  process.exit(0);
});
await new Promise(() => {});
