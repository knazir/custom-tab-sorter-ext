import { TabInfo } from '../types';
import { logError } from '../utils/errors';
import { PROTECTED_URL_PATTERNS } from '../config/constants';

export async function getTargetTabs(
  urlRegex?: string
): Promise<TabInfo[]> {
  const queryOptions: chrome.tabs.QueryInfo = {
    currentWindow: true
  };

  const tabs = await chrome.tabs.query(queryOptions);

  let filteredTabs = tabs.filter(tab => {
    if (tab.id === undefined || tab.url === undefined) return false;

    // Check against protected URL patterns
    return !PROTECTED_URL_PATTERNS.some(pattern =>
      tab.url!.startsWith(pattern) || tab.url!.includes(pattern)
    );
  });

  if (urlRegex) {
    try {
      const regex = new RegExp(urlRegex, 'i');

      const beforeCount = filteredTabs.length;
      filteredTabs = filteredTabs.filter(tab => {
        return regex.test(tab.url!);
      });
    } catch (e) {
      logError('Invalid URL regex', e);
      // Return unfiltered tabs if regex is invalid
    }
  }

  return filteredTabs.map(tab => ({
    id: tab.id!,
    title: tab.title || '',
    url: tab.url!,
    favIconUrl: tab.favIconUrl,
    index: tab.index,
    pinned: tab.pinned || false,
    windowId: tab.windowId!,
    groupId: tab.groupId
  }));
}

export async function moveTabs(
  tabs: TabInfo[],
  keepPinnedStatic: boolean
): Promise<void> {

  const tabsByWindow = new Map<number, TabInfo[]>();

  for (const tab of tabs) {
    const windowTabs = tabsByWindow.get(tab.windowId) || [];
    windowTabs.push(tab);
    tabsByWindow.set(tab.windowId, windowTabs);
  }


  for (const [windowId, windowTabs] of tabsByWindow) {

    const pinnedTabs = windowTabs.filter(t => t.pinned);
    const unpinnedTabs = windowTabs.filter(t => !t.pinned);


    if (keepPinnedStatic) {
      // Start moving unpinned tabs after all pinned tabs
      let targetIndex = pinnedTabs.length;

      for (const tab of unpinnedTabs) {
        try {
          await chrome.tabs.move(tab.id, {
            windowId,
            index: targetIndex
          });
          targetIndex++;
        } catch (error) {
          logError(`Failed to move tab ${tab.id}`, error);
        }
      }
    } else {
      // Move all tabs including pinned ones
      let targetIndex = 0;
      for (const tab of windowTabs) {
        try {
          await chrome.tabs.move(tab.id, {
            windowId,
            index: targetIndex
          });
          targetIndex++;
        } catch (error) {
          logError(`Failed to move tab ${tab.id}`, error);
        }
      }
    }
  }

}

export async function focusTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId!, { focused: true });
}

export async function loadTab(tabId: number): Promise<boolean> {
  try {
    // Reload the tab to force it to load
    await chrome.tabs.reload(tabId);
    // Wait for it to complete loading
    return new Promise((resolve) => {
      const listener = (tabIdUpdated: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabIdUpdated === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout after 10 seconds
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(false);
      }, 10000);
    });
  } catch (error) {
    return false;
  }
}

export async function getUnloadedTabs(tabs: TabInfo[]): Promise<number[]> {
  const unloadedTabIds: number[] = [];
  for (const tab of tabs) {
    const fullTab = await chrome.tabs.get(tab.id);
    if (fullTab.status === 'unloaded' || fullTab.discarded) {
      unloadedTabIds.push(tab.id);
    }
  }
  return unloadedTabIds;
}