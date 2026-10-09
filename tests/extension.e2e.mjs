import { chromium } from 'playwright';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

// Dedicated temporary browser profile: never touches the user's Chrome data.
const root = resolve(import.meta.dirname, '..');
const profile = await mkdtemp(join(tmpdir(), 'context-workspace-e2e-'));
const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<title>${req.url === '/task' ? '任务资料' : '无关页面'}</title><h1>Local extension test fixture</h1>`); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const errors = [];
let browser;
async function launch() {
  browser = await chromium.launchPersistentContext(profile, {
    ...(process.env.CW_BROWSER_EXECUTABLE ? { executablePath: process.env.CW_BROWSER_EXECUTABLE } : { channel: 'chromium' }),
    headless: true, viewport: { width: 390, height: 1000 },
    args: [`--disable-extensions-except=${join(root, 'dist')}`, `--load-extension=${join(root, 'dist')}`],
  });
  let worker = browser.serviceWorkers()[0];
  if (!worker) worker = await browser.waitForEvent('serviceworker');
  const id = new URL(worker.url()).hostname;
  const panel = await browser.newPage();
  panel.on('pageerror', error => errors.push(error.message));
  await panel.goto(`chrome-extension://${id}/index.html`);
  await panel.getByRole('button', { name: '＋ 新建 Context' }).waitFor();
  return { panel, worker };
}
// The review dialog renders each title once; without this the service worker can still see an
// empty title and fall back to the hostname.
async function titled(panel, expected) {
  await panel.waitForFunction(async expected => (await Promise.all(expected.map(([id]) => chrome.tabs.get(id)))).every((tab, i) => tab.status === 'complete' && tab.title === expected[i][1]), expected);
}
// Chrome reports a DevTools issue for any control without id or name.
async function fieldsNamed(panel) {
  return await panel.evaluate(() => [...document.querySelectorAll('input, select, textarea')].every(el => el.name || el.id));
}
// Match the physical tab, and separately verify its visible title and URL. The accessibility
// name's whitespace between the two text elements can change before layout settles.
async function uncheckTab(dialog, tabId, title, url) {
  const label = dialog.locator(`label[for="review-tab-${tabId}"]`);
  await label.waitFor();
  assert.equal(await label.textContent(), `${title}${url}`);
  await label.getByRole('checkbox').uncheck();
}
async function command(panel, message) {
  const response = await panel.evaluate(message => chrome.runtime.sendMessage(message), message);
  assert.equal(response.ok, true, JSON.stringify(response));
  return response.result;
}
try {
  let { panel } = await launch();
  const options = await panel.evaluate(async () => ({ behavior: await chrome.sidePanel.getPanelBehavior(), options: await chrome.sidePanel.getOptions({}) }));
  assert.equal(options.behavior.openPanelOnActionClick, true);
  assert.equal(options.options.path, 'index.html');
  await panel.getByRole('button', { name: '创建第一个 Context' }).click();
  await panel.getByLabel('Context 名称', { exact: true }).fill('测试 / 任务现场');
  await panel.getByLabel('分类').fill('学习');
  await panel.getByLabel('备注 / 上次做到哪里').fill('下次继续读资料');
  await panel.getByRole('button', { name: '保存 Context' }).click();
  await panel.getByRole('heading', { name: '测试 / 任务现场', exact: true }).waitFor();
  let data = await command(panel, { type: 'list' });
  const contextId = data.workspace.contexts[0].id;
  const windowId = await panel.evaluate(async () => (await chrome.windows.getCurrent()).id);
  const owned = await panel.evaluate(async url => await chrome.tabs.create({ url, active: true }), `${origin}/task`);
  await panel.waitForFunction(async id => (await chrome.tabs.get(id)).title === '任务资料', owned.id);
  // Use the actual UI action while the controlled webpage is the browser's active tab.
  await panel.getByRole('button', { name: '＋ 添加当前标签页' }).click();
  await panel.getByRole('status').filter({ hasText: '当前网页已保存' }).waitFor();
  await panel.getByText('当前窗口：尚未绑定。保存网页不会绑定窗口；「恢复为新窗口」才会把新窗口和这个 Context 绑在一起。').waitFor();
  data = await command(panel, { type: 'list' });
  assert.equal(data.workspace.contexts[0].resources[0].url, `${origin}/task`);
  const unrelated = await panel.evaluate(async origin => {
    return [await chrome.tabs.create({ url: `${origin}/other`, active: false }), await chrome.tabs.create({ url: `${origin}/task`, active: false })];
  }, origin);
  await panel.getByRole('button', { name: '关闭 Context 窗口', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '已关闭 1 个标签' }).waitFor();
  const tabIds = await panel.evaluate(async () => (await chrome.tabs.query({})).map(tab => tab.id));
  assert.ok(!tabIds.includes(owned.id));
  assert.ok(unrelated.every(tab => tabIds.includes(tab.id)));
  await panel.getByRole('button', { name: '↗ 恢复为新窗口', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '已打开 1 个' }).waitFor();
  await panel.getByRole('button', { name: '↗ 恢复为新窗口', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '已在打开状态 1 个' }).waitFor();
  const mappedWindowId = await panel.evaluate(async () => (await chrome.storage.session.get('context-windows-v1'))['context-windows-v1'][0].windowId);
  assert.notEqual(mappedWindowId, windowId);
  const restoredTabs = await panel.evaluate(async windowId => await chrome.tabs.query({ windowId }), mappedWindowId);
  assert.equal(restoredTabs.length, 1);
  assert.equal(restoredTabs[0].pendingUrl ?? restoredTabs[0].url, `${origin}/task`);
  // Save the same URL from the source window; it must stay open and be reported on close.
  await titled(panel, [[unrelated[0].id, '无关页面'], [unrelated[1].id, '任务资料']]);
  await panel.getByRole('button', { name: '保存当前窗口', exact: true }).click();
  const saveReview = panel.getByRole('dialog', { name: '保存当前窗口', exact: true });
  await saveReview.waitFor();
  assert.equal(await fieldsNamed(panel), true);
  assert.equal(await saveReview.getByRole('checkbox').count(), 2);
  for (const checkbox of await saveReview.getByRole('checkbox').all()) assert.equal(await checkbox.isChecked(), true);
  await uncheckTab(saveReview, unrelated[0].id, '无关页面', `${origin}/other`);
  await saveReview.getByRole('button', { name: '确认保存', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '已保存并关联 1 个标签' }).waitFor();
  // D1: no new tabs means no confirmation, even when other windows retain bindings.
  await panel.getByRole('button', { name: '关闭 Context 窗口', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '另有 1 个本 Context 的标签在其他窗口，未关闭' }).waitFor();
  assert.equal(await panel.getByRole('dialog').count(), 0);
  assert.equal(await panel.evaluate(async id => (await chrome.tabs.get(id)).id, unrelated[1].id), unrelated[1].id);
  await panel.getByRole('button', { name: '↗ 恢复为新窗口', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '已打开 1 个' }).waitFor();
  const newTabs = await panel.evaluate(async origin => {
    const windowId = (await chrome.storage.session.get('context-windows-v1'))['context-windows-v1'][0].windowId;
    return [await chrome.tabs.create({ windowId, url: `${origin}/task`, active: false }), await chrome.tabs.create({ windowId, url: `${origin}/keep`, active: false })];
  }, origin);
  await titled(panel, [[newTabs[0].id, '任务资料'], [newTabs[1].id, '无关页面']]);
  await panel.getByRole('button', { name: '关闭 Context 窗口', exact: true }).click();
  const closeReview = panel.getByRole('dialog', { name: '保存新标签后关闭', exact: true });
  await closeReview.waitFor();
  assert.equal(await closeReview.getByRole('checkbox').count(), 2);
  await uncheckTab(closeReview, newTabs[1].id, '无关页面', `${origin}/keep`);
  await closeReview.getByRole('button', { name: '确认并关闭', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '已关闭 2 个标签，本窗口保留 1 个网页标签；另有 1 个本 Context 的标签在其他窗口，未关闭' }).waitFor();
  const remainingIds = await panel.evaluate(async () => (await chrome.tabs.query({})).map(tab => tab.id));
  assert.ok(!remainingIds.includes(newTabs[0].id));
  assert.ok(remainingIds.includes(newTabs[1].id));
  assert.ok(unrelated.every(tab => remainingIds.includes(tab.id)));
  await panel.getByRole('button', { name: '↗ 恢复为新窗口', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '已打开 1 个' }).waitFor();
  await panel.getByRole('button', { name: '编辑', exact: true }).click();
  assert.equal(await fieldsNamed(panel), true);
  await panel.getByLabel('Context 名称', { exact: true }).fill('测试 / 已改名');
  await panel.getByLabel('备注 / 上次做到哪里').fill('已保存进度，重启后继续');
  await panel.getByRole('combobox').selectOption('waiting');
  await panel.getByRole('button', { name: '保存 Context' }).click();
  await panel.getByText('已保存进度，重启后继续', { exact: true }).waitFor();
  const search = panel.getByRole('textbox', { name: '搜索 Context 或标签页标题' });
  await search.fill('不存在的关键词');
  await panel.getByText('没有匹配的 Context 或标签页标题。').waitFor();
  await search.fill('任务资料');
  await panel.getByRole('heading', { name: '测试 / 已改名', exact: true }).waitFor();
  await search.fill('已改名');
  await panel.getByRole('heading', { name: '测试 / 已改名', exact: true }).waitFor();
  await search.fill('');
  const overflow = await panel.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
  console.log('PASS: extension loaded; UI create/add/edit/search/save-window; restore in a new window; one-click close; new-tab review; outside-window notice.');
  await browser.close();
  ({ panel } = await launch());
  data = await command(panel, { type: 'list' });
  assert.equal(data.workspace.contexts[0].note, '已保存进度，重启后继续');
  assert.equal(data.workspace.contexts[0].resources.length, 1);
  const session = await panel.evaluate(async () => await chrome.storage.session.get(['context-tabs-v1', 'context-windows-v1']));
  assert.equal(session['context-tabs-v1'], undefined);
  assert.equal(session['context-windows-v1'], undefined);
  await panel.getByRole('button', { name: '关闭 Context 窗口', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '已关闭 0 个标签' }).waitFor();
  await command(panel, { type: 'restore', id: contextId });
  const resourceButton = panel.locator('.resource-link').first();
  await resourceButton.click();
  await panel.getByRole('status').filter({ hasText: '已在打开状态 1 个' }).waitFor();
  await panel.getByRole('button', { name: '移除 任务资料', exact: true }).click();
  await panel.getByText('打开一个相关网页，然后点击「添加当前标签页」。').waitFor();
  panel.once('dialog', dialog => dialog.accept());
  await panel.getByRole('button', { name: '删除 Context', exact: true }).click();
  await panel.getByRole('button', { name: '创建第一个 Context' }).waitFor();
  await panel.getByRole('button', { name: '载入 2 个演示 Context' }).click();
  await panel.getByRole('heading', { name: '秋招 / 百度 AI 产品经理', exact: true }).waitFor();
  await mkdir(join(root, 'docs'), { recursive: true });
  await panel.screenshot({ path: join(root, 'docs', 'preview.png'), fullPage: true });
  // The real side panel opens at 360px and can be dragged narrower; 240px is the practical floor.
  // This approximates width changes only. Dragging the panel's own edge is not scriptable.
  for (const width of [320, 280, 240]) {
    await panel.setViewportSize({ width, height: 900 });
    assert.equal(await panel.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}px`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: real browser restart retained local data and cleared bindings; single open/remove/delete/demo; 390px down to 240px layout; no page errors.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
