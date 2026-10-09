import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, TabReview, Workspace as WorkspaceData } from '../types';
import { currentWindowId, isExtension, send } from '../storage/client';
import { DATA_KEY, WINDOWS_KEY } from '../storage/workspace';
import { errorMessage, matches } from '../utils/context';
import { ContextForm } from '../components/ContextForm';
import { ContextList } from '../components/ContextList';
import { ContextDetail } from '../components/ContextDetail';
import { ReviewDialog } from '../components/ReviewDialog';
import { UsageExport } from '../components/UsageExport';

export function Workspace() {
  const [data, setData] = useState<WorkspaceData>({ version: 1, contexts: [] });
  const [selectedId, setSelectedId] = useState<string>();
  const [currentContextId, setCurrentContextId] = useState<string>();
  const [review, setReview] = useState<TabReview>();
  const [exportContent, setExportContent] = useState<string>();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { const result = await send({ type: 'list', windowId: await currentWindowId() }); setData(result.workspace); setCurrentContextId(result.currentContextId); setLoaded(true); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => {
    void refresh();
    if (!isExtension) {
      const onStorage = () => { void refresh(); };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => { if ((area === 'local' && changes[DATA_KEY]) || (area === 'session' && changes[WINDOWS_KEY])) void refresh(); };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [refresh]);
  const visible = data.contexts.filter(context => matches(context, query));
  const selected = visible.find(c => c.id === selectedId) ?? visible[0];
  async function run(command: Command): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await send(command); setData(result.workspace);
      if (result.selectedId) { setSelectedId(result.selectedId); setQuery(''); }
      if (result.review) { setReview(result.review); return true; }
      if (result.events) setExportContent(JSON.stringify(result.events, null, 2));
      setNotice(result.message ?? ''); return true;
    } catch (e) { setError(errorMessage(e)); await refresh(); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function tabAction(type: 'add-current' | 'preview-window' | 'restore' | 'open-resource', resourceId?: string) {
    if (!selected) return;
    try {
      if (type === 'restore') { await run({ type, id: selected.id }); return; }
      const windowId = await currentWindowId();
      if (type === 'open-resource' && resourceId) await run({ type, id: selected.id, resourceId, windowId });
      else if (type !== 'open-resource') await run({ type, id: selected.id, windowId });
    } catch (e) { setError(errorMessage(e)); }
  }
  return <main className="app">
    <header className="app-header"><div className="brand-mark" aria-hidden="true">c.</div><div><h1>Context Workspace</h1><p>按正在做的事，整理你的网页。</p></div><span className="local-badge"><i />本地</span></header>
    {isExtension && <p className="window-context">{currentContextId ? `当前窗口：${data.contexts.find(c => c.id === currentContextId)?.name ?? '未关联 Context'}` : '当前窗口：尚未绑定。保存网页不会绑定窗口；「恢复为新窗口」才会把新窗口和这个 Context 绑在一起。'}</p>}
    {review && <ReviewDialog review={review} contextName={data.contexts.find(c => c.id === review.contextId)?.name ?? 'Context'} busy={busy} error={error} onCancel={() => { setReview(undefined); setError(''); }} onSubmit={async selectedTabIds => { const ok = await run({ type: review.kind === 'save' ? 'save-window' : 'close', id: review.contextId, review, selectedTabIds }); if (ok) setReview(undefined); }} />}
    {exportContent !== undefined && <UsageExport initial={exportContent} onClose={() => setExportContent(undefined)} />}
    {!isExtension && <div className="preview-banner">网页预览模式 · 可编辑示例数据。添加、打开与关闭标签请使用 Chrome 扩展；两处数据互相独立。</div>}
    <div className="top-row"><div><span className="section-label">MY CONTEXTS</span><span className="count">{data.contexts.length}</span></div><button className="small-primary" disabled={!loaded || busy || editing || creating} onClick={() => { setCreating(true); setNotice(''); }}>＋ 新建 Context</button></div>
    {creating && <section className="create-box"><h2>准备开始什么？</h2><ContextForm busy={busy} onCancel={() => setCreating(false)} onSave={async fields => { const ok = await run({ type: 'create', fields }); if (ok) setCreating(false); return ok; }} /></section>}
    <label className="search" htmlFor="context-search"><span aria-hidden="true">⌕</span><input id="context-search" name="context-search" autoComplete="off" aria-label="搜索 Context 或标签页标题" placeholder="搜索 Context 或标签页标题…" value={query} disabled={editing || creating} onChange={e => setQuery(e.target.value)} /></label>
    {error && <div className="message error" role="alert">{error}<button onClick={() => { setError(''); void refresh(); }} disabled={busy}>重新读取</button></div>}
    {notice && <div className="message" role="status">{notice}</div>}
    {!loaded ? <div className="empty-state">{error ? '暂时无法读取工作区。' : '正在读取工作区…'}</div> : !data.contexts.length && !creating ? <div className="empty-state"><div className="empty-symbol" aria-hidden="true">＋</div><h2>给下一件事，留一个位置。</h2><p>创建 Context，把相关网页放在一起。<br />关掉标签，也能找回任务的起点。</p><button disabled={busy} onClick={() => setCreating(true)}>创建第一个 Context</button><button className="quiet" disabled={busy} onClick={() => void run({ type: 'demo' })}>载入 2 个演示 Context</button></div> : <>
      {!visible.length && <p className="empty-resources">没有匹配的 Context 或标签页标题。</p>}
      <ContextList contexts={visible} selectedId={selected?.id} onSelect={setSelectedId} busy={busy || editing || creating} />
      {selected && !creating && <ContextDetail key={selected.id} context={selected} busy={busy} isExtension={isExtension} run={run} tabAction={tabAction} onEditing={setEditing} />}
    </>}
    {isExtension && <button className="quiet research-export" disabled={busy || !loaded} onClick={() => void run({ type: 'usage-events' })}>检查并导出研究记录</button>}
    <footer className="app-footer">CONTEXT WORKSPACE <span>MVP 0.2 · 仅网页资源</span></footer>
  </main>;
}
