import type { Context } from '../types';
import { statusLabels } from './ContextForm';
interface Props { contexts: Context[]; selectedId?: string; onSelect: (id: string) => void; busy: boolean }
export function ContextList({ contexts, selectedId, onSelect, busy }: Props) {
  return <div className="context-list" aria-label="Context 列表">{contexts.map(context => <button key={context.id} className={`context-card ${selectedId === context.id ? 'selected' : ''}`} aria-pressed={selectedId === context.id} onClick={() => onSelect(context.id)} disabled={busy}>
    <span className="card-top"><span className={`status-dot ${context.status}`} /><span className="card-title">{context.name}</span><span className="arrow" aria-hidden="true">↗</span></span>
    {!context.discreet && <span className="card-meta"><span>{context.category || '未分类'}</span><span>·</span><span>{context.resources.length} 个网页</span><span className="status-label">{statusLabels[context.status]}</span></span>}
  </button>)}</div>;
}
