import type { Command, Context, Result, TabBinding, TabReview, TabSnapshot, Workspace } from '../types';
import { errorMessage, fields, newContext, webUrl } from '../utils/context';
import { readBindings, readWorkspace, readWindows, writeBindings, writeWorkspace, writeWindows } from './workspace';
import { demoContexts } from './demo';
import { readUsage, recordUsage } from './usage';

// All mutations, including browser events, share the worker's read-modify-write queue.
let tail: Promise<unknown> = Promise.resolve();
export function serial<T>(job: () => Promise<T>): Promise<T> {
  const result = tail.then(job);
  tail = result.catch(() => undefined);
  return result;
}
export async function forgetTab(tabId: number, newUrl?: string): Promise<void> {
  const bindings = await readBindings();
  const kept = bindings.filter(b => b.tabId !== tabId || (newUrl !== undefined && b.url === newUrl));
  if (kept.length !== bindings.length) await writeBindings(kept);
}
export async function forgetWindow(windowId: number): Promise<void> {
  await writeWindows((await readWindows()).filter(b => b.windowId !== windowId));
}
export async function liveBinding(binding: TabBinding, windowId = binding.windowId): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(binding.tabId);
    // A pending navigation takes precedence over the committed URL.
    return tab.id === binding.tabId && (tab.pendingUrl ?? tab.url) === binding.url && (windowId === undefined || tab.windowId === windowId);
  } catch { return false; }
}
async function mappedWindow(contextId: string): Promise<number | undefined> {
  const mapping = (await readWindows()).find(b => b.contextId === contextId);
  if (!mapping) return;
  try { await chrome.windows.get(mapping.windowId); return mapping.windowId; }
  catch { await forgetWindow(mapping.windowId); }
}
async function windowTabs(windowId: number): Promise<TabSnapshot[]> {
  return (await chrome.tabs.query({ windowId })).flatMap(tab => {
    const url = tab.pendingUrl ?? tab.url;
    return tab.id !== undefined && tab.windowId === windowId && webUrl(url)
      ? [{ tabId: tab.id, windowId, url, title: tab.title || new URL(url).hostname }] : [];
  });
}
async function unsavedTabs(context: Context, windowId: number): Promise<TabSnapshot[]> {
  const bindings = await readBindings();
  return (await windowTabs(windowId)).filter(tab => !bindings.some(b => b.contextId === context.id && b.tabId === tab.tabId && b.url === tab.url && (b.windowId === undefined || b.windowId === windowId) && context.resources.some(r => r.id === b.resourceId && r.url === b.url)));
}
// Distinguish a saved resource with failed session association from a failed save.
class SavedTabBindingError extends Error {}
async function saveTabs(workspace: Workspace, context: Context, review: TabReview, selectedTabIds: number[]) {
  let saved = 0, skipped = 0;
  const savedTabIds: number[] = [];
  const seen = new Set<number>();
  for (const snapshot of review.tabs) {
    if (!selectedTabIds.includes(snapshot.tabId) || seen.has(snapshot.tabId)) continue;
    seen.add(snapshot.tabId);
    let tab: chrome.tabs.Tab;
    try { tab = await chrome.tabs.get(snapshot.tabId); } catch { skipped++; continue; }
    if (tab.id !== snapshot.tabId || snapshot.windowId !== review.windowId || tab.windowId !== review.windowId || (tab.pendingUrl ?? tab.url) !== snapshot.url || !webUrl(snapshot.url)) { skipped++; continue; }
    let resource = context.resources.find(r => r.url === snapshot.url);
    if (!resource) {
      resource = { id: crypto.randomUUID(), title: tab.title || new URL(snapshot.url).hostname, url: snapshot.url, favicon: tab.favIconUrl, addedAt: Date.now() };
      context.resources.push(resource);
    }
    context.updatedAt = Date.now();
    // Persist each resource before claiming its physical tab. Never close after a failed write.
    await writeWorkspace(workspace);
    try {
      const bindings = (await readBindings()).filter(b => !(b.contextId === context.id && b.tabId === snapshot.tabId));
      bindings.push({ contextId: context.id, resourceId: resource.id, tabId: snapshot.tabId, url: snapshot.url, windowId: review.windowId });
      await writeBindings(bindings);
    } catch (error) { throw new SavedTabBindingError(errorMessage(error)); }
    saved++; savedTabIds.push(snapshot.tabId);
  }
  if (saved) await recordUsage('tabs_saved', saved);
  return { saved, skipped, savedTabIds };
}
async function openResources(context: Context, resources: Context['resources'], windowId: number, active: boolean, restrictWindow: boolean) {
  let bindings = await readBindings();
  let opened = 0, reused = 0, failed = 0;
  for (const resource of resources) {
    try {
      let existing: TabBinding | undefined;
      for (const candidate of bindings.filter(b => b.contextId === context.id && b.resourceId === resource.id && b.url === resource.url)) {
        if (!await liveBinding(candidate)) { bindings = bindings.filter(b => b !== candidate); continue; }
        if (!restrictWindow || await liveBinding(candidate, windowId)) { existing = candidate; break; }
      }
      if (existing) {
        if (active) {
          const tab = await chrome.tabs.update(existing.tabId, { active: true });
          if (tab) await chrome.windows.update(tab.windowId, { focused: true });
        }
        reused++;
      } else {
        if (!webUrl(resource.url)) throw new Error('仅支持 HTTP / HTTPS 网页。');
        const tab = await chrome.tabs.create({ url: resource.url, active, windowId });
        if (tab.id === undefined) throw new Error('无法获取新标签 ID。');
        bindings.push({ contextId: context.id, resourceId: resource.id, tabId: tab.id, url: resource.url, windowId });
        await writeBindings(bindings);
        opened++;
      }
    } catch { failed++; }
  }
  await writeBindings(bindings);
  return { opened, reused, failed };
}
function openMessage({ opened, reused, failed }: { opened: number; reused: number; failed: number }) {
  return `已打开 ${opened} 个，已在打开状态 ${reused} 个${failed ? `；${failed} 个未完成，请重试` : ''}。`;
}
async function restore(context: Context): Promise<string> {
  let windowId = await mappedWindow(context.id);
  let resources = context.resources;
  let initial = 0;
  if (windowId === undefined) {
    const first = resources[0];
    const window = await chrome.windows.create({ url: first.url, focused: true, type: 'normal' });
    if (window?.id === undefined) throw new Error('无法创建 Context 窗口。');
    windowId = window.id;
    await writeWindows([...(await readWindows()).filter(b => b.contextId !== context.id && b.windowId !== windowId), { contextId: context.id, windowId }]);
    const tab = window.tabs?.[0];
    if (tab?.id !== undefined && tab.windowId === windowId && (tab.pendingUrl ?? tab.url) === first.url) {
      await writeBindings([...(await readBindings()), { contextId: context.id, resourceId: first.id, tabId: tab.id, url: first.url, windowId }]);
      initial = 1;
      resources = resources.slice(1);
    }
  } else { await chrome.windows.update(windowId, { focused: true }); }
  const counts = await openResources(context, resources, windowId, false, true);
  counts.opened += initial;
  await recordUsage('context_restored', counts.opened + counts.reused);
  return openMessage(counts);
}
async function closeContext(workspace: Workspace, context: Context, review?: TabReview, selectedTabIds: number[] = []): Promise<Result> {
  const windowId = await mappedWindow(context.id);
  let saveSkipped = 0;
  const preserved = new Set<number>();
  if (review) {
    if (review.kind !== 'close' || review.contextId !== context.id || review.windowId !== windowId) throw new Error('窗口关联已变化，请重新点击关闭。');
    const result = await saveTabs(workspace, context, review, selectedTabIds);
    saveSkipped = result.skipped;
    for (const tab of review.tabs) if (!result.savedTabIds.includes(tab.tabId)) preserved.add(tab.tabId);
  } else if (windowId !== undefined) {
    const tabs = await unsavedTabs(context, windowId);
    // The ordinary exit path remains one click when nothing needs review.
    if (tabs.length) return { workspace, review: { kind: 'close', contextId: context.id, windowId, tabs } };
  }
  let bindings = await readBindings();
  let closed = 0, skipped = 0, failed = 0;
  const otherWindowTabs = new Set<number>();
  for (const binding of bindings.filter(b => b.contextId === context.id)) {
    if (preserved.has(binding.tabId)) continue;
    if (!await liveBinding(binding)) { bindings = bindings.filter(b => b !== binding); skipped++; continue; }
    if (windowId !== undefined && !await liveBinding(binding, windowId)) { otherWindowTabs.add(binding.tabId); continue; }
    if (bindings.some(b => b.tabId === binding.tabId && b.contextId !== context.id && b.url === binding.url)) { skipped++; continue; }
    // Recheck immediately before removal, including the expected window when known.
    if (!await liveBinding(binding, windowId ?? binding.windowId)) { skipped++; continue; }
    try {
      await chrome.tabs.remove(binding.tabId);
      bindings = bindings.filter(b => b.tabId !== binding.tabId);
      closed++;
    } catch { failed++; }
  }
  await writeBindings(bindings);
  let retained = 0;
  if (windowId !== undefined) {
    try { retained = (await windowTabs(windowId)).length; } catch { /* The last tab may have closed its window. */ }
    if (!failed) await forgetWindow(windowId);
  }
  await recordUsage('context_closed', closed);
  return { workspace, message: `已关闭 ${closed} 个标签${windowId !== undefined ? `，本窗口保留 ${retained} 个网页标签` : ''}${otherWindowTabs.size ? `；另有 ${otherWindowTabs.size} 个本 Context 的标签在其他窗口，未关闭` : ''}${skipped ? `，保留或跳过 ${skipped} 个（共享、已跳转或已关闭）` : ''}${saveSkipped ? `；${saveSkipped} 个勾选标签因发生变化而跳过` : ''}${failed ? `；${failed} 个关闭失败，请重试` : ''}。保存的网页仍在。` };
}
export async function execute(command: Command): Promise<Result> {
  const workspace = await readWorkspace();
  if (command.type === 'list') return { workspace, currentContextId: (await readWindows()).find(b => b.windowId === command.windowId)?.contextId };
  if (command.type === 'usage-events') return { workspace, events: await readUsage() };
  if (command.type === 'demo') {
    if (workspace.contexts.length) throw new Error('仅在列表为空时载入示例，避免重复数据。');
    workspace.contexts = demoContexts();
    await writeWorkspace(workspace);
    return { workspace, message: '已载入示例；尚未打开任何页面。' };
  }
  if (command.type === 'create') {
    const context = newContext(command.fields);
    workspace.contexts.unshift(context);
    await writeWorkspace(workspace);
    await recordUsage('context_created', 0);
    return { workspace, selectedId: context.id, message: 'Context 已创建。' };
  }
  const context = workspace.contexts.find(c => c.id === command.id);
  if (!context) throw new Error('这个 Context 已不存在，请刷新列表。');
  if (command.type === 'preview-window') return { workspace, review: { kind: 'save', contextId: context.id, windowId: command.windowId, tabs: await windowTabs(command.windowId) } };
  if (command.type === 'save-window') {
    if (command.review.contextId !== context.id || command.review.kind !== 'save') throw new Error('请重新选择要保存的窗口。');
    const { saved, skipped } = await saveTabs(workspace, context, command.review, command.selectedTabIds);
    return { workspace, message: `已保存并关联 ${saved} 个标签，跳过 ${skipped} 个已变化或已关闭的标签。同一 Context 内相同 URL 不重复保存。` };
  }
  if (command.type === 'restore' || command.type === 'open-resource') {
    const resources = command.type === 'restore' ? context.resources : context.resources.filter(r => r.id === command.resourceId);
    if (!resources.length) throw new Error('没有可打开的网页。');
    return { workspace, message: command.type === 'restore' ? await restore(context) : openMessage(await openResources(context, resources, command.windowId, true, false)) };
  }
  if (command.type === 'close') return closeContext(workspace, context, command.review, command.selectedTabIds);
  let message = '已保存。';
  switch (command.type) {
    case 'update': Object.assign(context, fields(command.fields)); break;
    case 'delete':
      await writeBindings((await readBindings()).filter(b => b.contextId !== context.id));
      await writeWindows((await readWindows()).filter(b => b.contextId !== context.id));
      workspace.contexts = workspace.contexts.filter(c => c.id !== context.id);
      message = 'Context 已删除，浏览器中的页面保持打开。';
      break;
    case 'remove-resource':
      await writeBindings((await readBindings()).filter(b => !(b.contextId === context.id && b.resourceId === command.resourceId)));
      context.resources = context.resources.filter(r => r.id !== command.resourceId);
      message = '已移除保存的网页，浏览器中的页面保持打开。';
      break;
    case 'add-current': {
      const [tab] = await chrome.tabs.query({ active: true, windowId: command.windowId });
      const url = tab?.pendingUrl ?? tab?.url;
      if (tab?.id === undefined || !webUrl(url)) throw new Error('请先切换到 HTTP / HTTPS 网页。浏览器内部页、扩展页和本地文件暂不支持。');
      try {
        const result = await saveTabs(workspace, context, { kind: 'save', contextId: context.id, windowId: command.windowId, tabs: [{ tabId: tab.id, windowId: command.windowId, url, title: tab.title || url }] }, [tab.id]);
        return { workspace, message: result.saved ? '当前网页已保存并关联；同一 Context 内相同 URL 不重复保存。' : '当前标签发生变化，未保存，请重试。' };
      } catch (error) {
        if (error instanceof SavedTabBindingError) throw new Error(`网页已保存，但会话映射失败；请再次添加当前页。${errorMessage(error)}`);
        throw error;
      }
    }
    default: throw new Error('无法识别的操作。');
  }
  context.updatedAt = Date.now();
  await writeWorkspace(workspace);
  return { workspace, message };
}
