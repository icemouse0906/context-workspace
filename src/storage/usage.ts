import type { UsageEvent } from '../types';

// Temporary research scaffolding. Remove this module and its callers after user research.
export const USAGE_KEY = 'context-usage-research-v1';
export const MAX_USAGE_EVENTS = 500;
const names = new Set(['context_created', 'tabs_saved', 'context_restored', 'context_closed']);
export async function readUsage(): Promise<UsageEvent[]> {
  const value = (await chrome.storage.local.get(USAGE_KEY))[USAGE_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter(e => e && names.has(e.event) && Number.isFinite(e.timestamp) && Number.isInteger(e.resource_count) && e.resource_count >= 0)
    .slice(-MAX_USAGE_EVENTS).map(e => ({ event: e.event, timestamp: e.timestamp, resource_count: e.resource_count }));
}
export async function recordUsage(event: UsageEvent['event'], resource_count: number): Promise<void> {
  try {
    const events = await readUsage();
    events.push({ event, timestamp: Date.now(), resource_count });
    await chrome.storage.local.set({ [USAGE_KEY]: events.slice(-MAX_USAGE_EVENTS) });
  } catch { /* Research failures must never affect workspace operations. */ }
}
