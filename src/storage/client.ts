import type { Command, Response, Result } from '../types';
import { fields, newContext, parseWorkspace } from '../utils/context';
import { DATA_KEY } from './workspace';
import { demoContexts } from './demo';
export const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);

export async function currentWindowId(): Promise<number> {
  if (!isExtension) return -1;
  const window = await chrome.windows.getCurrent();
  if (window.id === undefined) throw new Error('无法确定当前浏览器窗口。');
  return window.id;
}
export async function send(command: Command): Promise<Result> {
  if (isExtension) {
    const response: Response | undefined = await chrome.runtime.sendMessage(command);
    if (!response) throw new Error('扩展后台未响应，请在扩展管理页重新加载。');
    if (!response.ok) throw new Error(response.error);
    return response.result;
  }
  // Vite preview only: local CRUD with clearly disabled browser-tab operations.
  const raw = localStorage.getItem(DATA_KEY);
  const workspace = parseWorkspace(raw ? JSON.parse(raw) : undefined);
  let selectedId: string | undefined;
  if (command.type === 'list') return { workspace };
  if (command.type === 'usage-events') throw new Error('研究记录仅在扩展中提供。');
  if (command.type === 'create') {
    const context = newContext(command.fields); workspace.contexts.unshift(context); selectedId = context.id;
  } else if (command.type === 'demo') {
    if (workspace.contexts.length) throw new Error('请在空列表中载入示例。');
    workspace.contexts = demoContexts();
  } else {
    const context = workspace.contexts.find(c => c.id === command.id);
    if (!context) throw new Error('Context 不存在。');
    switch (command.type) {
      case 'update': Object.assign(context, fields(command.fields), { updatedAt: Date.now() }); break;
      case 'delete': workspace.contexts = workspace.contexts.filter(c => c.id !== command.id); break;
      case 'remove-resource': context.resources = context.resources.filter(r => r.id !== command.resourceId); context.updatedAt = Date.now(); break;
      default: throw new Error('网页预览不支持操作浏览器标签，请加载 dist 扩展。');
    }
  }
  localStorage.setItem(DATA_KEY, JSON.stringify(workspace));
  return { workspace, selectedId, message: '已保存到网页预览的本地数据。' };
}
