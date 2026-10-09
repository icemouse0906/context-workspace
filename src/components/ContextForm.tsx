import { useState, type FormEvent } from 'react';
import { STATUSES, type ContextFields } from '../types';
export const statusLabels = { active: 'Active', waiting: 'Waiting', done: 'Done', archived: 'Archived' };
interface Props { initial?: ContextFields; busy: boolean; onSave: (fields: ContextFields) => Promise<boolean>; onCancel: () => void }
export function ContextForm({ initial, busy, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ContextFields>(initial ?? { name: '', category: '', status: 'active', note: '' });
  async function submit(event: FormEvent) { event.preventDefault(); await onSave(draft); }
  return <form className="context-form" autoComplete="off" onSubmit={submit}>
    <label htmlFor="context-name">Context 名称<input id="context-name" name="context-name" autoFocus required maxLength={120} value={draft.name} placeholder="例如：学习 / Figma" onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
    <div className="form-row">
      <label htmlFor="context-category">分类 <span className="optional">可选</span><input id="context-category" name="context-category" maxLength={80} value={draft.category} placeholder="例如：学习" onChange={e => setDraft({ ...draft, category: e.target.value })} /></label>
      <label htmlFor="context-status">状态<select id="context-status" name="context-status" aria-label="状态" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as ContextFields['status'] })}>{STATUSES.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
    </div>
    <label htmlFor="context-note">备注 / 上次做到哪里<textarea id="context-note" name="context-note" rows={4} maxLength={5000} value={draft.note} placeholder="留一句话，让下次继续更轻松。" onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
    <label className="checkbox-row" htmlFor="context-discreet"><input id="context-discreet" name="context-discreet" type="checkbox" checked={draft.discreet ?? false} onChange={e => setDraft({ ...draft, discreet: e.target.checked })} />只显示名称</label>
    <div className="button-row"><button className="primary" disabled={busy || !draft.name.trim()} type="submit">{busy ? '保存中…' : '保存 Context'}</button><button type="button" disabled={busy} onClick={onCancel}>取消</button></div>
  </form>;
}
