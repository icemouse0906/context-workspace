import type { TabResource } from '../types';
interface Props { resources: TabResource[]; busy: boolean; canOpen: boolean; onOpen: (id: string) => void; onRemove: (id: string) => void }
export function ResourceList({ resources, busy, canOpen, onOpen, onRemove }: Props) {
  return <ul className="resources">{resources.map((resource, index) => <li key={resource.id}>
    <span className="resource-icon" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <button className="resource-link" title={resource.url} disabled={busy || !canOpen} onClick={() => onOpen(resource.id)}>
      <span>{resource.title}</span><small>{new URL(resource.url).hostname}</small>
    </button>
    <button className="icon-button" title={`移除 ${resource.title}`} aria-label={`移除 ${resource.title}`} disabled={busy} onClick={() => onRemove(resource.id)}>×</button>
  </li>)}</ul>;
}
