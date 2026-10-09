import { STATUSES, type Context, type ContextFields, type Workspace } from '../types';

export function webUrl(value: string | undefined): value is string {
  if (!value) return false;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}
export function fields(input: ContextFields): ContextFields {
  if (typeof input?.name !== 'string' || !input.name.trim()) throw new Error('请填写 Context 名称。');
  if (input.name.trim().length > 120) throw new Error('名称最多 120 个字符。');
  if (!STATUSES.includes(input.status)) throw new Error('Context 状态无效。');
  if (input.category !== undefined && (typeof input.category !== 'string' || input.category.length > 80)) throw new Error('分类最多 80 个字符。');
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 5000)) throw new Error('备注最多 5000 个字符。');
  if (input.discreet !== undefined && typeof input.discreet !== 'boolean') throw new Error('显示设置无效。');
  return { discreet: input.discreet ?? false, name: input.name.trim(), category: input.category?.trim() ?? '', status: input.status, note: input.note ?? '' };
}
export function newContext(input: ContextFields): Context {
  const now = Date.now();
  return { ...fields(input), id: crypto.randomUUID(), createdAt: now, updatedAt: now, resources: [] };
}
export function matches(context: Context, query: string): boolean {
  const term = query.trim().toLocaleLowerCase();
  // Discreet hides titles from passive display only. Search is user-initiated, and results
  // still render the context name alone, so matching a title exposes nothing new.
  return !term || context.name.toLocaleLowerCase().includes(term) || context.resources.some(r => r.title.toLocaleLowerCase().includes(term));
}
export function parseWorkspace(value: unknown): Workspace {
  if (value === undefined) return { version: 1, contexts: [] };
  const data = value as Workspace;
  if (data?.version !== 1 || !Array.isArray(data.contexts)) throw new Error('本地数据格式无法识别。原始数据已保留，请勿卸载扩展。');
  const ids = new Set<string>();
  for (const c of data.contexts) {
    if (!c || typeof c.id !== 'string' || ids.has(c.id) || !Number.isFinite(c.createdAt) || !Number.isFinite(c.updatedAt) || !Array.isArray(c.resources)) throw new Error('本地 Context 数据损坏；原始数据已保留。');
    fields(c); c.discreet ??= false; ids.add(c.id);
    const resourceIds = new Set<string>();
    for (const r of c.resources) {
      if (!r || typeof r.id !== 'string' || resourceIds.has(r.id) || typeof r.title !== 'string' || !webUrl(r.url) || !Number.isFinite(r.addedAt) || (r.favicon !== undefined && typeof r.favicon !== 'string')) throw new Error('本地网页资源数据损坏；原始数据已保留。');
      resourceIds.add(r.id);
    }
  }
  return data;
}
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : '操作失败，请重试。'; }
