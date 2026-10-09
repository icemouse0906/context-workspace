import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execute, forgetTab, serial } from '../src/storage/service';
import { DATA_KEY, SESSION_KEY, WINDOWS_KEY } from '../src/storage/workspace';
import { MAX_USAGE_EVENTS, USAGE_KEY } from '../src/storage/usage';
import { matches } from '../src/utils/context';
import type { ContextFields, TabBinding, Workspace } from '../src/types';

let local: Record<string, unknown>, session: Record<string, unknown>;
let tabs: Map<number, { id: number; url: string; title: string; windowId: number; pendingUrl?: string }>;
let current: number, nextId: number, nextWindowId: number;
let windows: Set<number>;
const draft: ContextFields = { name: '学习 / Figma', category: '学习', status: 'active', note: '从组件开始' };
const area = (data: () => Record<string, unknown>) => ({
  get: vi.fn(async (key: string) => ({ [key]: structuredClone(data()[key]) })),
  set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(data(), structuredClone(value)); }),
});
beforeEach(() => {
  local = {}; session = {}; current = 1; nextId = 10; nextWindowId = 20; windows = new Set([4]);
  tabs = new Map([[1, { id: 1, url: 'https://example.com/task', title: 'Figma 文档', windowId: 4 }], [2, { id: 2, url: 'https://example.com/other', title: '无关页面', windowId: 4 }], [3, { id: 3, url: 'https://example.com/task', title: '相同 URL 未关联', windowId: 4 }]]);
  vi.stubGlobal('chrome', {
    storage: { local: area(() => local), session: area(() => session) },
    tabs: {
      query: vi.fn(async ({ windowId, active }: { windowId: number; active?: boolean }) => [...tabs.values()].filter(t => t.windowId === windowId && (!active || t.id === current))),
      get: vi.fn(async (id: number) => { if (!tabs.has(id)) throw new Error('Missing tab'); return tabs.get(id); }),
      create: vi.fn(async ({ url, windowId }: { url: string; windowId: number }) => { const tab = { id: nextId++, url, title: url, windowId }; tabs.set(tab.id, tab); return tab; }),
      update: vi.fn(async (id: number) => tabs.get(id)),
      remove: vi.fn(async (id: number) => { tabs.delete(id); }),
    },
    windows: {
      update: vi.fn(),
      get: vi.fn(async (id: number) => { if (!windows.has(id)) throw new Error('Missing window'); return { id }; }),
      create: vi.fn(async ({ url }: { url: string }) => {
        const id = nextWindowId++; windows.add(id);
        const tab = { id: nextId++, url, title: url, windowId: id }; tabs.set(tab.id, tab);
        return { id, tabs: [tab] };
      }),
    },
  });
});
async function create() { return (await execute({ type: 'create', fields: draft })).selectedId!; }
async function add(id: string) { return execute({ type: 'add-current', id, windowId: 4 }); }
function bindings() { return session[SESSION_KEY] as TabBinding[]; }

describe('Context lifecycle and persistence', () => {
  it('creates, edits metadata, searches by name/title, removes resource and deletes context', async () => {
    const id = await create();
    await add(id);
    const { workspace } = await execute({ type: 'update', id, fields: { ...draft, name: '小说 / 第三卷', status: 'waiting', note: '下一步写港口' } });
    expect(workspace.contexts[0].note).toBe('下一步写港口');
    expect(matches(workspace.contexts[0], '小说')).toBe(true);
    expect(matches(workspace.contexts[0], 'FIGMA')).toBe(true);
    expect(matches(workspace.contexts[0], '无匹配')).toBe(false);
    await execute({ type: 'remove-resource', id, resourceId: workspace.contexts[0].resources[0].id });
    expect(tabs.has(1)).toBe(true);
    expect(bindings()).toEqual([]);
    expect((await execute({ type: 'delete', id })).workspace.contexts).toEqual([]);
  });
  it('rejects blank names and unsupported tabs without changing stored resources', async () => {
    await expect(execute({ type: 'create', fields: { ...draft, name: ' ' } })).rejects.toThrow('名称');
    const id = await create(); tabs.get(1)!.url = 'chrome://extensions/';
    await expect(add(id)).rejects.toThrow('HTTP');
    expect((local[DATA_KEY] as Workspace).contexts[0].resources).toEqual([]);
  });
  it('deduplicates saved URLs while tracking explicitly associated physical tabs', async () => {
    const id = await create(); await add(id); current = 3;
    const { workspace } = await add(id);
    expect(workspace.contexts[0].resources).toHaveLength(1);
    expect(bindings()).toHaveLength(2);
  });
  it('local contexts survive session reset; old browser tabs are never inferred by URL', async () => {
    const id = await create(); await add(id); session = {};
    expect((await execute({ type: 'list' })).workspace.contexts).toHaveLength(1);
    await execute({ type: 'close', id });
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    await execute({ type: 'restore', id });
    expect(chrome.windows.create).toHaveBeenCalledOnce();
  });
  it('serializes concurrent panel writes', async () => {
    await Promise.all(Array.from({ length: 12 }, () => serial(() => execute({ type: 'create', fields: draft }))));
    expect((local[DATA_KEY] as Workspace).contexts).toHaveLength(12);
  });
  it('reports write failures and preserves unrecognized data', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA'));
    await expect(create()).rejects.toThrow('QUOTA');
    local[DATA_KEY] = { version: 999, contexts: [] };
    await expect(execute({ type: 'list' })).rejects.toThrow('原始数据已保留');
    expect(local[DATA_KEY]).toEqual({ version: 999, contexts: [] });
  });
  it.each(['get', 'set'] as const)('reports saved data and retry advice when add-current session %s fails', async operation => {
    const id = await create();
    vi.mocked(chrome.storage.session[operation]).mockRejectedValueOnce(new Error('Session unavailable'));
    await expect(add(id)).rejects.toThrow('网页已保存，但会话映射失败；请再次添加当前页。');
    expect((local[DATA_KEY] as Workspace).contexts[0].resources.map(r => r.url)).toEqual(['https://example.com/task']);
    expect(session[SESSION_KEY]).toBeUndefined();
    await add(id);
    expect((local[DATA_KEY] as Workspace).contexts[0].resources).toHaveLength(1);
    expect(bindings().map(b => b.tabId)).toEqual([1]);
  });
  it('does not claim the page was saved when add-current local persistence fails', async () => {
    const id = await create();
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('Disk full'));
    await expect(add(id)).rejects.toThrow(/^Disk full$/);
    expect((local[DATA_KEY] as Workspace).contexts[0].resources).toEqual([]);
    expect(chrome.storage.session.set).not.toHaveBeenCalled();
  });
});
describe('restore and conservative tab closing', () => {
  it('closes only bound tab IDs, preserving same-domain and exact-URL unrelated tabs', async () => {
    const id = await create(); await add(id); await execute({ type: 'close', id });
    expect(tabs.has(1)).toBe(false); expect(tabs.has(2)).toBe(true); expect(tabs.has(3)).toBe(true);
    expect((local[DATA_KEY] as Workspace).contexts[0].resources).toHaveLength(1);
  });
  it('restores after closing and reuses valid bindings on repeated restore', async () => {
    const id = await create(); await add(id); await execute({ type: 'close', id });
    await execute({ type: 'restore', id }); await execute({ type: 'restore', id });
    expect(chrome.windows.create).toHaveBeenCalledOnce();
    const resourceId = (local[DATA_KEY] as Workspace).contexts[0].resources[0].id;
    await execute({ type: 'open-resource', id, resourceId, windowId: 4 });
    expect(chrome.tabs.update).toHaveBeenCalledWith(10, { active: true });
  });
  it('preserves a bound tab that navigated away, including pending navigation', async () => {
    const id = await create(); await add(id);
    tabs.get(1)!.pendingUrl = 'https://example.com/different';
    await execute({ type: 'close', id });
    expect(tabs.has(1)).toBe(true); expect(bindings()).toEqual([]);
  });
  it('navigation, removal and replacement forget ownership rather than reclaiming a returning URL', async () => {
    const id = await create(); await add(id);
    await forgetTab(1, 'https://example.com/other');
    await execute({ type: 'close', id });
    expect(tabs.has(1)).toBe(true);
    await add(id); await forgetTab(1);
    expect(bindings()).toEqual([]);
  });
  it('preserves a shared tab until the other context is removed', async () => {
    const first = await create(); const second = await create(); await add(first); await add(second);
    await execute({ type: 'close', id: first }); expect(tabs.has(1)).toBe(true);
    await execute({ type: 'delete', id: second }); await execute({ type: 'close', id: first }); expect(tabs.has(1)).toBe(false);
  });
  it('deleting a resource revokes closing ownership', async () => {
    const id = await create(); const { workspace } = await add(id);
    await execute({ type: 'remove-resource', id, resourceId: workspace.contexts[0].resources[0].id });
    await execute({ type: 'close', id }); expect(tabs.has(1)).toBe(true);
  });
  it('partial restore failure reports counts, retaining successful mappings', async () => {
    const id = await create(); await add(id); current = 2; await add(id); await execute({ type: 'close', id });
    vi.mocked(chrome.tabs.create).mockRejectedValueOnce(new Error('Creation failed'));
    const result = await execute({ type: 'restore', id });
    expect(result.message).toContain('已打开 1'); expect(result.message).toContain('1 个未完成'); expect(bindings()).toHaveLength(1);
  });
  it('partial close failure retains failed tab bindings for retry', async () => {
    const id = await create(); await add(id);
    vi.mocked(chrome.tabs.remove).mockRejectedValueOnce(new Error('Removal failed'));
    const result = await execute({ type: 'close', id });
    expect(result.message).toContain('1 个关闭失败'); expect(bindings()).toHaveLength(1);
    await execute({ type: 'close', id }); expect(bindings()).toHaveLength(0);
  });
});

async function restored() {
  const id = await create(); await add(id);
  await execute({ type: 'restore', id });
  const windowId = (session[WINDOWS_KEY] as { windowId: number }[])[0].windowId;
  return { id, windowId };
}
function newTab(windowId: number, url = 'https://example.com/new'): NonNullable<ReturnType<typeof tabs.get>> {
  const tab = { id: nextId++, url, title: 'New research tab', windowId };
  tabs.set(tab.id, tab); return tab;
}
describe('0.2 window save, restore and close', () => {
  it('previews only HTTP(S), defaults via a complete snapshot, deduplicates selected URLs', async () => {
    const id = await create(); newTab(4, 'chrome://newtab/');
    const review = (await execute({ type: 'preview-window', id, windowId: 4 })).review!;
    expect(review.tabs.map(t => t.tabId)).toEqual([1, 2, 3]);
    const result = await execute({ type: 'save-window', id, review, selectedTabIds: [1, 3] });
    expect(result.workspace.contexts[0].resources).toHaveLength(1);
    expect(bindings().map(b => b.tabId)).toEqual([1, 3]);
    expect(tabs.size).toBe(4);
  });
  it.each(['url', 'pendingUrl', 'windowId', 'closed'] as const)('skips a snapshot whose %s changed before submission', async change => {
    const id = await create();
    const review = (await execute({ type: 'preview-window', id, windowId: 4 })).review!;
    if (change === 'closed') tabs.delete(1);
    else if (change === 'windowId') tabs.get(1)!.windowId = 99;
    else tabs.get(1)![change] = 'https://example.com/task#changed';
    const result = await execute({ type: 'save-window', id, review, selectedTabIds: [1] });
    expect(result.workspace.contexts[0].resources).toEqual([]);
    expect(result.message).toContain('跳过 1');
  });
  it('creates a separate window without moving old bindings, then reuses only valid tabs in that window', async () => {
    const { id, windowId } = await restored();
    expect(tabs.get(1)!.windowId).toBe(4);
    expect(windowId).not.toBe(4);
    await execute({ type: 'restore', id });
    expect(chrome.windows.create).toHaveBeenCalledOnce();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    tabs.get(10)!.url += '#changed';
    await execute({ type: 'restore', id });
    expect(chrome.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ windowId, url: 'https://example.com/task' }));
    expect(tabs.has(10)).toBe(true);
  });
  it('closes immediately without a review when there are no unsaved tabs, preserving bindings in other windows', async () => {
    const { id } = await restored();
    const result = await execute({ type: 'close', id });
    expect(result.review).toBeUndefined();
    expect(chrome.tabs.remove).toHaveBeenCalledWith(10);
    expect(tabs.has(1)).toBe(true);
    expect(result.message).toContain('另有 1 个本 Context 的标签在其他窗口，未关闭');
    expect(bindings().map(b => b.tabId)).toEqual([1]);
    expect(session[WINDOWS_KEY]).toEqual([]);
  });
  it('counts valid outside tabs separately from stale bindings and in-window retained tabs', async () => {
    const { id, windowId } = await restored();
    current = 2; await add(id);
    current = 3; await add(id);
    tabs.get(3)!.pendingUrl = 'https://example.com/changed';
    const retained = newTab(windowId);
    const review = (await execute({ type: 'close', id })).review!;
    const result = await execute({ type: 'close', id, review, selectedTabIds: [] });
    expect(result.message).toContain('另有 2 个本 Context 的标签在其他窗口，未关闭');
    expect(result.message).toContain('本窗口保留 1 个网页标签');
    expect(result.message).toContain('保留或跳过 1 个');
    expect([1, 2, 3, retained.id].every(tabId => tabs.has(tabId))).toBe(true);
    expect(chrome.tabs.remove).toHaveBeenCalledExactlyOnceWith(10);
  });
  it('omits the outside-window notice when all remaining outside bindings are stale', async () => {
    const { id } = await restored();
    tabs.delete(1);
    const result = await execute({ type: 'close', id });
    expect(result.message).not.toContain('在其他窗口');
    expect(result.message).toContain('保留或跳过 1 个');
  });
  it('does not close anything before review; saves selected new tabs and leaves unselected and later tabs open', async () => {
    const { id, windowId } = await restored();
    const selected = newTab(windowId), unchecked = newTab(windowId, 'https://example.com/keep');
    const review = (await execute({ type: 'close', id })).review!;
    expect(review.tabs.map(t => t.tabId)).toEqual([selected.id, unchecked.id]);
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    expect((local[DATA_KEY] as Workspace).contexts[0].resources).toHaveLength(1);
    const later = newTab(windowId, 'https://example.com/later');
    const result = await execute({ type: 'close', id, review, selectedTabIds: [selected.id] });
    expect(tabs.has(selected.id)).toBe(false);
    expect(tabs.has(unchecked.id)).toBe(true); expect(tabs.has(later.id)).toBe(true);
    expect(result.workspace.contexts[0].resources.map(r => r.url)).toContain(selected.url);
    expect(result.message).toContain('保留 2');
  });
  it('skips a selected tab that navigates or moves while the close review is open', async () => {
    const { id, windowId } = await restored();
    const navigating = newTab(windowId), moving = newTab(windowId, 'https://example.com/moving');
    const review = (await execute({ type: 'close', id })).review!;
    navigating.pendingUrl = 'https://example.com/other';
    moving.windowId = 4;
    const result = await execute({ type: 'close', id, review, selectedTabIds: [navigating.id, moving.id] });
    expect(tabs.has(navigating.id)).toBe(true); expect(tabs.has(moving.id)).toBe(true);
    expect(result.workspace.contexts[0].resources).toHaveLength(1);
    expect(result.message).toContain('2 个勾选标签因发生变化而跳过');
  });
  it('never closes an unchecked tab even if another panel saves it during review', async () => {
    const { id, windowId } = await restored(); const unchecked = newTab(windowId);
    const review = (await execute({ type: 'close', id })).review!;
    current = unchecked.id; await execute({ type: 'add-current', id, windowId });
    await execute({ type: 'close', id, review, selectedTabIds: [] });
    expect(tabs.has(unchecked.id)).toBe(true);
  });
  it('aborts closing if resource or binding persistence fails', async () => {
    const { id, windowId } = await restored(); const fresh = newTab(windowId);
    const review = (await execute({ type: 'close', id })).review!;
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('Disk full'));
    await expect(execute({ type: 'close', id, review, selectedTabIds: [fresh.id] })).rejects.toThrow('Disk full');
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('Session full'));
    await expect(execute({ type: 'close', id, review, selectedTabIds: [fresh.id] })).rejects.toThrow('Session full');
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });
  it('rejects close confirmation after window association is lost', async () => {
    const { id, windowId } = await restored(); newTab(windowId);
    const review = (await execute({ type: 'close', id })).review!; session = {};
    await expect(execute({ type: 'close', id, review, selectedTabIds: [] })).rejects.toThrow('窗口关联已变化');
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });
  it('reports the current window context independently of list selection', async () => {
    const { id, windowId } = await restored();
    expect((await execute({ type: 'list', windowId })).currentContextId).toBe(id);
    expect((await execute({ type: 'list', windowId: 4 })).currentContextId).toBeUndefined();
  });
  it('retains one-click 0.1 behavior after session reset without claiming tabs by URL', async () => {
    const { id, windowId } = await restored(); newTab(windowId); session = {};
    const result = await execute({ type: 'close', id });
    expect(result.review).toBeUndefined(); expect(chrome.tabs.remove).not.toHaveBeenCalled();
    await execute({ type: 'restore', id }); expect(chrome.windows.create).toHaveBeenCalledTimes(2);
  });
  it('adds a false default to old version-1 data while preserving all resources and metadata', async () => {
    const id = await create(); await add(id);
    const original = structuredClone(local[DATA_KEY]) as Workspace;
    delete original.contexts[0].discreet; local[DATA_KEY] = original;
    const result = await execute({ type: 'list' });
    expect(result.workspace).toEqual({ ...original, contexts: [{ ...original.contexts[0], discreet: false }] });
    const updated = await execute({ type: 'update', id, fields: { ...draft, discreet: true } });
    // Discreet keeps titles out of the list, but search must still find them by title.
    expect(matches(updated.workspace.contexts[0], '文档')).toBe(true);
    expect(matches(updated.workspace.contexts[0], '学习')).toBe(true);
  });
});
describe('temporary local research events', () => {
  it('records only event, timestamp and resource_count, with a fixed retention limit', async () => {
    local[USAGE_KEY] = Array.from({ length: MAX_USAGE_EVENTS }, () => ({ event: 'context_created', timestamp: 1, resource_count: 0, url: 'discard-me' }));
    const id = await create(); await add(id); await execute({ type: 'restore', id }); await execute({ type: 'close', id });
    const events = (await execute({ type: 'usage-events' })).events!;
    expect(events).toHaveLength(MAX_USAGE_EVENTS);
    expect(events.slice(-4).map(e => e.event)).toEqual(['context_created', 'tabs_saved', 'context_restored', 'context_closed']);
    for (const event of events) expect(Object.keys(event).sort()).toEqual(['event', 'resource_count', 'timestamp']);
  });
  it.each(['read', 'write'])('swallows event %s failures without failing create, save, restore or close', async failure => {
    if (failure === 'write') {
      vi.mocked(chrome.storage.local.set).mockImplementation(async value => {
        if (USAGE_KEY in value) throw new Error('Event quota');
        Object.assign(local, structuredClone(value));
      });
    } else {
      vi.mocked(chrome.storage.local.get).mockImplementation(async key => {
        if (key === USAGE_KEY) throw new Error('Event read');
        return { [key as string]: structuredClone(local[key as string]) };
      });
    }
    const id = await create(); await add(id);
    await expect(execute({ type: 'restore', id })).resolves.toMatchObject({ message: expect.stringContaining('已打开 1') });
    await expect(execute({ type: 'close', id })).resolves.toMatchObject({ message: expect.stringContaining('已关闭 1') });
    expect((local[DATA_KEY] as Workspace).contexts[0].resources).toHaveLength(1);
  });
});
