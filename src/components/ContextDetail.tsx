import { useEffect, useState } from 'react';
import type { Command, Context, ContextFields } from '../types';
import { ContextForm, statusLabels } from './ContextForm';
import { ResourceList } from './ResourceList';
interface Props { context: Context; busy: boolean; isExtension: boolean; run: (command: Command) => Promise<boolean>; tabAction: (type: 'add-current' | 'preview-window' | 'restore' | 'open-resource', resourceId?: string) => void; onEditing: (editing: boolean) => void }
export function ContextDetail({ context, busy, isExtension, run, tabAction, onEditing }: Props) {
  const [editing, setEditing] = useState(false);
  useEffect(() => () => onEditing(false), [onEditing]);
  function edit(value: boolean) { setEditing(value); onEditing(value); }
  async function save(fields: ContextFields) {
    const success = await run({ type: 'update', id: context.id, fields });
    if (success) edit(false);
    return success;
  }
  return <section className="detail" aria-label="Context 详情">
    <div className="section-label">当前 CONTEXT</div>
    {editing ? <ContextForm initial={context} busy={busy} onSave={save} onCancel={() => edit(false)} /> : <>
      <div className="detail-heading"><h2>{context.name}</h2><button className="quiet" disabled={busy} onClick={() => edit(true)}>编辑</button></div>
      {!context.discreet && <><div className="detail-meta"><span className={`badge ${context.status}`}>{statusLabels[context.status]}</span><span>{context.category || '未分类'}</span></div>
      <div className="note"><span className="section-label">备注 / 上次做到哪里</span><p>{context.note || '还没有备注。记下进度，下次接着做。'}</p></div></>}
      <div className="workspace-actions">
        <button className="primary" disabled={busy || !isExtension} onClick={() => tabAction('add-current')}>＋ 添加当前标签页</button>
        <button disabled={busy || !isExtension} onClick={() => tabAction('preview-window')}>保存当前窗口</button>
        <div className="button-row"><button disabled={busy || !isExtension || !context.resources.length} onClick={() => tabAction('restore')}>↗ 恢复为新窗口</button><button disabled={busy || !isExtension || !context.resources.length} onClick={() => void run({ type: 'close', id: context.id })}>关闭 Context 窗口</button></div>
        <p className="helper">只关闭这个窗口里、这次已关联且网址没变的标签。共享的、跳转过的，以及其他窗口里的，都会留下。网页里还没保存的输入也不会被记住。</p>
      </div>
      {!context.discreet && <><div className="resources-heading"><h3>保存的网页</h3><span>{context.resources.length}</span></div>
      {context.resources.length ? <ResourceList resources={context.resources} busy={busy} canOpen={isExtension} onOpen={id => tabAction('open-resource', id)} onRemove={id => void run({ type: 'remove-resource', id: context.id, resourceId: id })} /> : <div className="empty-resources">打开一个相关网页，然后点击「添加当前标签页」。</div>}</>}
      <div className="detail-footer"><span>更新于 {new Date(context.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><button className="danger quiet" disabled={busy} onClick={() => { if (confirm(`删除「${context.name}」及其保存记录？此操作无法撤销，已打开的网页不会关闭。`)) void run({ type: 'delete', id: context.id }); }}>删除 Context</button></div>
    </>}
  </section>;
}
