export const STATUSES = ['active', 'waiting', 'done', 'archived'] as const;
export type ContextStatus = typeof STATUSES[number];
export interface TabResource { id: string; title: string; url: string; favicon?: string; addedAt: number }
export interface Context {
  id: string; name: string; category?: string; status: ContextStatus; note?: string;
  discreet?: boolean; createdAt: number; updatedAt: number; resources: TabResource[];
}
export type ContextFields = Pick<Context, 'name' | 'category' | 'status' | 'note' | 'discreet'>;
export interface Workspace { version: 1; contexts: Context[] }
/** Only valid within a browser session. Never infer ownership from a domain or a URL alone. */
export interface TabBinding { contextId: string; resourceId: string; tabId: number; url: string; windowId?: number }
export type Command =
  | { type: 'list'; windowId?: number }
  | { type: 'usage-events' }
  | { type: 'preview-window'; id: string; windowId: number }
  | { type: 'save-window'; id: string; review: TabReview; selectedTabIds: number[] }
  | { type: 'create'; fields: ContextFields }
  | { type: 'update'; id: string; fields: ContextFields }
  | { type: 'delete'; id: string }
  | { type: 'demo' }
  | { type: 'add-current'; id: string; windowId: number }
  | { type: 'remove-resource'; id: string; resourceId: string }
  | { type: 'open-resource'; id: string; resourceId: string; windowId: number }
  | { type: 'restore'; id: string }
  | { type: 'close'; id: string; review?: TabReview; selectedTabIds?: number[] };
export interface WindowBinding { contextId: string; windowId: number }
export interface TabSnapshot { tabId: number; windowId: number; url: string; title: string }
export interface TabReview { kind: 'save' | 'close'; contextId: string; windowId: number; tabs: TabSnapshot[] }
export interface UsageEvent { event: 'context_created' | 'tabs_saved' | 'context_restored' | 'context_closed'; timestamp: number; resource_count: number }
export interface Result { workspace: Workspace; message?: string; selectedId?: string; currentContextId?: string; review?: TabReview; events?: UsageEvent[] }
export type Response = { ok: true; result: Result } | { ok: false; error: string };
