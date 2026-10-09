import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TabReview } from '../types';

export function Modal({ title, busy, onCancel, children }: { title: string; busy: boolean; onCancel: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="review-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2>{title}</h2>{children}
  </dialog>;
}
export function ReviewDialog({ review, contextName, busy, error, onCancel, onSubmit }: { review: TabReview; contextName: string; busy: boolean; error: string; onCancel: () => void; onSubmit: (ids: number[]) => void }) {
  const [selected, setSelected] = useState(() => review.tabs.map(tab => tab.tabId));
  const closing = review.kind === 'close';
  return <Modal title={closing ? '保存新标签后关闭' : '保存当前窗口'} busy={busy} onCancel={onCancel}>
    <p>目标 Context：{contextName}</p>
    <p className="helper">{closing ? '这些标签尚未关联到本 Context。勾选的标签会先保存，再关闭；未勾选的标签会保留。' : '请选择要保存的 HTTP / HTTPS 标签，默认全部勾选。'}</p>
    <ul className="review-tabs">{review.tabs.map(tab => <li key={tab.tabId}><label className="checkbox-row" htmlFor={`review-tab-${tab.tabId}`}>
      <input id={`review-tab-${tab.tabId}`} name={`review-tab-${tab.tabId}`} type="checkbox" checked={selected.includes(tab.tabId)} disabled={busy} onChange={e => setSelected(ids => e.target.checked ? [...ids, tab.tabId] : ids.filter(id => id !== tab.tabId))} />
      <span>{tab.title}<small>{tab.url}</small></span>
    </label></li>)}</ul>
    {!review.tabs.length && <p>当前窗口没有可保存的网页。</p>}
    {error && <p role="alert" className="message error">{error}</p>}
    <div className="button-row"><button className="primary" disabled={busy || (!closing && !selected.length)} onClick={() => onSubmit(selected)}>{closing ? '确认并关闭' : '确认保存'}</button><button disabled={busy} onClick={onCancel}>取消</button></div>
  </Modal>;
}
