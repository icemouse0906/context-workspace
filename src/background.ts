import type { Command, Response } from './types';
import { execute, forgetTab, forgetWindow, serial } from './storage/service';
import { errorMessage } from './utils/context';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
chrome.runtime.onMessage.addListener((message: Command, sender, sendResponse: (response: Response) => void) => {
  // Only this extension's own UI can issue workspace operations.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  serial(() => execute(message)).then(
    result => sendResponse({ ok: true, result }),
    error => sendResponse({ ok: false, error: errorMessage(error) }),
  );
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => { void serial(() => forgetTab(tabId)).catch(console.error); });
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url) void serial(() => forgetTab(tabId, change.url)).catch(console.error);
});
// Replacement tabs lose ownership rather than inheriting an uncertain identity.
chrome.tabs.onReplaced.addListener((_added, removed) => { void serial(() => forgetTab(removed)).catch(console.error); });

chrome.tabs.onDetached.addListener(tabId => { void serial(() => forgetTab(tabId)).catch(console.error); });
chrome.windows.onRemoved.addListener(windowId => { void serial(() => forgetWindow(windowId)).catch(console.error); });
