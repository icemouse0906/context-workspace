import type { TabBinding, WindowBinding, Workspace } from '../types';
import { parseWorkspace } from '../utils/context';
export const DATA_KEY = 'context-workspace-v1';
export const SESSION_KEY = 'context-tabs-v1';
export async function readWorkspace(): Promise<Workspace> { return parseWorkspace((await chrome.storage.local.get(DATA_KEY))[DATA_KEY]); }
export async function writeWorkspace(workspace: Workspace): Promise<void> { await chrome.storage.local.set({ [DATA_KEY]: workspace }); }
export async function readBindings(): Promise<TabBinding[]> { const value = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter((b): b is TabBinding => Boolean(b) && typeof b.contextId === 'string' && typeof b.resourceId === 'string' && Number.isInteger(b.tabId) && typeof b.url === 'string'); }
export async function writeBindings(bindings: TabBinding[]): Promise<void> { await chrome.storage.session.set({ [SESSION_KEY]: bindings }); }

export const WINDOWS_KEY = 'context-windows-v1';
export async function readWindows(): Promise<WindowBinding[]> {
  const value = (await chrome.storage.session.get(WINDOWS_KEY))[WINDOWS_KEY];
  return Array.isArray(value) ? value.filter(b => b && typeof b.contextId === 'string' && Number.isInteger(b.windowId)) : [];
}
export async function writeWindows(bindings: WindowBinding[]): Promise<void> { await chrome.storage.session.set({ [WINDOWS_KEY]: bindings }); }
