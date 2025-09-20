import { TabInfo } from '../types';

export async function getTargetTabs(
  urlRegex?: string
): Promise<TabInfo[]> {
  const queryOptions: chrome.tabs.QueryInfo = {
    currentWindow: true
  };

  const tabs = await chrome.tabs.query(queryOptions);

  let filteredTabs = tabs.filter(tab =>
    tab.id !== undefined &&
    tab.url !== undefined &&
    !tab.url.startsWith('chrome://') &&
    !tab.url.startsWith('chrome-extension://') &&
    !tab.url.startsWith('edge://') &&
    !tab.url.startsWith('about:') &&
    !tab.url.startsWith('file://') &&  // Local files may need explicit permission
    !tab.url.includes('chrome.google.com/webstore')  // Chrome Web Store is protected
  );

  if (urlRegex) {
    try {
      console.log('Testing regex pattern:', urlRegex);
      const regex = new RegExp(urlRegex, 'i');
      console.log('Regex created successfully:', regex);

      const beforeCount = filteredTabs.length;
      filteredTabs = filteredTabs.filter(tab => {
        const matches = regex.test(tab.url!);
        if (matches) {
          console.log('✅ Matched:', tab.url);
        } else {
          console.log('❌ Not matched:', tab.url);
        }
        return matches;
      });
      console.log(`Filtered from ${beforeCount} to ${filteredTabs.length} tabs`);
    } catch (e) {
      console.error('Invalid regex:', urlRegex, e);
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
    let targetIndex = 0;
    const pinnedTabs = windowTabs.filter(t => t.pinned);
    const unpinnedTabs = windowTabs.filter(t => !t.pinned);

    if (keepPinnedStatic) {
      targetIndex = pinnedTabs.length;

      for (const tab of unpinnedTabs) {
        await chrome.tabs.move(tab.id, {
          windowId,
          index: targetIndex++
        });
      }
    } else {
      for (const tab of windowTabs) {
        await chrome.tabs.move(tab.id, {
          windowId,
          index: targetIndex++
        });
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
    console.error(`Failed to load tab ${tabId}:`, error);
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