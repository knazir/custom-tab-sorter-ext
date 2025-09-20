import { getSettings, saveSettings } from './config';
import { getTargetTabs, moveTabs, focusTab, getUnloadedTabs } from './tabs';
import { createComparator, stableSort, TabWithValue } from './sorting';
import { extractValueFromTab, injectContentScript } from './messaging';
import { Settings, SortKey, SortResult, ExtractedValue } from '../types';

chrome.runtime.onInstalled.addListener(() => {
  // Create parent menu
  chrome.contextMenus.create({
    id: 'tab-sorter-parent',
    title: 'Tab Sorter',
    contexts: ['page', 'selection', 'link', 'image']
  });

  // Auto sort option
  chrome.contextMenus.create({
    id: 'auto-sort-by-element',
    parentId: 'tab-sorter-parent',
    title: '⚡ Quick sort by this value',
    contexts: ['page', 'selection', 'link', 'image']
  });

  // Configure in popup option
  chrome.contextMenus.create({
    id: 'configure-sort-by-element',
    parentId: 'tab-sorter-parent',
    title: '⚙️ Configure sort with this field...',
    contexts: ['page', 'selection', 'link', 'image']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'auto-sort-by-element' && tab?.id && tab?.url) {
    await handleAutoSort(tab.id, tab.url);
  } else if (info.menuItemId === 'configure-sort-by-element' && tab?.id && tab?.url) {
    await handleConfigureSort(tab.id, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SORT_TABS') {
    handleSortRequest(message).then(sendResponse);
    return true;
  }

  if (message.type === 'PREVIEW_SORT') {
    handlePreviewRequest(message).then(sendResponse);
    return true;
  }

  if (message.type === 'FOCUS_TAB') {
    focusTab(message.tabId).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'GET_CONTEXT_DATA') {
    chrome.storage.local.get('contextMenuData').then((data) => {
      sendResponse(data.contextMenuData || null);
    });
    return true;
  }

  if (message.type === 'CLEAR_CONTEXT_DATA') {
    chrome.storage.local.remove('contextMenuData').then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'TEST_REGEX') {
    handleTestRegex(message.urlRegex).then(sendResponse);
    return true;
  }

  if (message.type === 'TEST_SELECTOR') {
    handleTestSelector(message.tabId, message.selector, message.parseAs).then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_UNLOADED_TABS') {
    handleCheckUnloadedTabs(message.urlRegex).then(sendResponse);
    return true;
  }

  if (message.type === 'LOAD_UNLOADED_TABS') {
    handleLoadUnloadedTabs(message.urlRegex).then(sendResponse);
    return true;
  }

  return false;
});

async function handleTestSelector(tabId: number, selector: string, parseAs?: string) {
  const result = await extractValueFromTab(tabId, selector, undefined, parseAs);
  return result;
}

async function handleTestRegex(urlRegex?: string) {
  // Test which tabs match the regex pattern
  const tabs = await getTargetTabs(urlRegex);
  return tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl
  }));
}

async function handleCheckUnloadedTabs(urlRegex?: string) {
  const tabs = await getTargetTabs(urlRegex);
  const unloadedTabIds = await getUnloadedTabs(tabs);

  if (unloadedTabIds.length > 0) {
    const unloadedTabs = tabs.filter(t => unloadedTabIds.includes(t.id));
    return {
      hasUnloaded: true,
      count: unloadedTabIds.length,
      total: tabs.length,
      unloadedTabs: unloadedTabs.map(t => ({
        id: t.id,
        title: t.title || 'Untitled',
        url: t.url
      }))
    };
  }

  return {
    hasUnloaded: false,
    count: 0,
    total: tabs.length
  };
}

async function handleLoadUnloadedTabs(urlRegex?: string) {
  const tabs = await getTargetTabs(urlRegex);
  const unloadedTabIds = await getUnloadedTabs(tabs);

  if (unloadedTabIds.length === 0) {
    return {
      success: true,
      loadedCount: 0,
      message: 'No unloaded tabs to load'
    };
  }

  let loadedCount = 0;
  const errors: string[] = [];

  // Load tabs in batches to avoid overwhelming the browser
  const batchSize = 3;
  for (let i = 0; i < unloadedTabIds.length; i += batchSize) {
    const batch = unloadedTabIds.slice(i, i + batchSize);

    await Promise.all(batch.map(async (tabId) => {
      try {
        // Simply reload the tab - this will force it to load
        await chrome.tabs.reload(tabId);
        loadedCount++;
      } catch (error) {
        const tab = tabs.find(t => t.id === tabId);
        errors.push(`Failed to load tab: ${tab?.title || tabId}`);
      }
    }));

    // Small delay between batches to avoid overwhelming the browser
    if (i + batchSize < unloadedTabIds.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Wait a bit for tabs to fully load
  await new Promise(resolve => setTimeout(resolve, 1500));

  return {
    success: loadedCount > 0,
    loadedCount,
    totalUnloaded: unloadedTabIds.length,
    errors,
    message: `Loaded ${loadedCount} of ${unloadedTabIds.length} suspended tabs`
  };
}


async function handleAutoSort(tabId: number, tabUrl: string) {
  const injected = await injectContentScript(tabId);

  if (!injected) {
    // Show error badge for protected pages
    chrome.action.setBadgeText({ text: '⚠' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
    return;
  }

  const response = await chrome.tabs.sendMessage(tabId, {
    type: 'GET_CONTEXT_TARGET'
  });

  if (response?.selector) {
    // Extract domain pattern from URL for filtering
    const url = new URL(tabUrl);
    const domainPattern = `${url.protocol}//${url.hostname}.*`;

    // Get current settings
    const settings = await getSettings();

    // Detect parse type based on the value
    let parseAs: 'text' | 'number' | 'price' | 'date' = 'text';
    if (response.value) {
      const value = String(response.value).trim();
      if (/^\d+(\.\d+)?$/.test(value)) {
        parseAs = 'number';
      } else if (/[\$£€¥]/.test(value) || /\d+[.,]\d{2}/.test(value)) {
        parseAs = 'price';
      } else if (/\d{4}-\d{2}-\d{2}/.test(value) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)) {
        parseAs = 'date';
      }
    }

    // Create sort key
    const sortKey: SortKey = {
      id: `auto-${Date.now()}`,
      label: 'Quick Sort',
      selector: response.selector,
      direction: 'asc',
      parseAs
    };

    // Clear the context target
    await chrome.tabs.sendMessage(tabId, {
      type: 'CLEAR_CONTEXT_TARGET'
    });

    // Perform the sort immediately
    try {
      await performSort(
        domainPattern,  // Use domain pattern as URL filter
        [sortKey],
        settings.keepPinnedStatic,
        settings.missingValuePolicy
      );

      // Show success badge
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

      // Clear badge after 2 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 2000);
    } catch (error) {
      // Show error badge
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 3000);
    }
  }
}

async function handleConfigureSort(tabId: number, tabUrl: string) {
  const injected = await injectContentScript(tabId);

  if (!injected) {
    // Show error badge for protected pages
    chrome.action.setBadgeText({ text: '⚠' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
    return;
  }

  const response = await chrome.tabs.sendMessage(tabId, {
    type: 'GET_CONTEXT_TARGET'
  });

  if (response?.selector) {
    // Extract domain pattern from URL for filtering
    const url = new URL(tabUrl);
    const domainPattern = `${url.protocol}//${url.hostname}.*`;

    // Store the context data for the popup to retrieve
    const contextData = {
      selector: response.selector,
      value: response.value,
      urlRegex: domainPattern,
      sourceUrl: tabUrl,
      timestamp: Date.now()
    };

    await chrome.storage.local.set({ contextMenuData: contextData });

    // Clear the context target
    await chrome.tabs.sendMessage(tabId, {
      type: 'CLEAR_CONTEXT_TARGET'
    });

    // Set a badge to indicate data is ready (user needs to click extension icon)
    chrome.action.setBadgeText({ text: '•' });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  }
}

async function handleSortRequest(message: any): Promise<SortResult> {
  const { urlRegex, sortKeys, keepPinnedStatic, missingValuePolicy } = message;

  return performSort(
    urlRegex,
    sortKeys,
    keepPinnedStatic,
    missingValuePolicy
  );
}

async function handlePreviewRequest(message: any): Promise<SortResult> {
  const { urlRegex, sortKeys, missingValuePolicy } = message;

  const tabs = await getTargetTabs(urlRegex);
  const extractedValues = await extractValuesFromTabs(tabs, sortKeys[0]);

  const tabsWithValues: TabWithValue[] = tabs.map(tab => {
    const extracted = extractedValues.find(e => e.tabId === tab.id);
    return {
      ...tab,
      extractedValue: extracted?.value,
      rawText: extracted?.rawText
    };
  });

  const comparator = createComparator(sortKeys, missingValuePolicy);
  const sortedTabs = stableSort(tabsWithValues, comparator);

  const errors = extractedValues
    .filter(e => e.value === null)
    .map(e => {
      const tab = tabs.find(t => t.id === e.tabId);
      return {
        tabId: e.tabId,
        error: e.diagnostics?.notes || 'Failed to extract value',
        tabTitle: tab?.title,
        tabUrl: tab?.url
      };
    });

  return { tabs: sortedTabs, errors };
}

async function performSort(
  urlRegex: string | undefined,
  sortKeys: SortKey[],
  keepPinnedStatic: boolean,
  missingValuePolicy: 'last' | 'first' | 'error'
): Promise<SortResult> {
  const tabs = await getTargetTabs(urlRegex);
  const extractedValues = await extractValuesFromTabs(tabs, sortKeys[0]);

  const tabsWithValues: TabWithValue[] = tabs.map(tab => {
    const extracted = extractedValues.find(e => e.tabId === tab.id);
    return {
      ...tab,
      extractedValue: extracted?.value,
      rawText: extracted?.rawText
    };
  });

  const comparator = createComparator(sortKeys, missingValuePolicy);
  const sortedTabs = stableSort(tabsWithValues, comparator);

  await moveTabs(sortedTabs, keepPinnedStatic);

  const errors = extractedValues
    .filter(e => e.value === null)
    .map(e => {
      const tab = tabs.find(t => t.id === e.tabId);
      return {
        tabId: e.tabId,
        error: e.diagnostics?.notes || 'Failed to extract value',
        tabTitle: tab?.title,
        tabUrl: tab?.url
      };
    });

  return { tabs: sortedTabs, errors };
}

async function extractValuesFromTabs(
  tabs: { id: number }[],
  sortKey: SortKey
): Promise<ExtractedValue[]> {
  const promises = tabs.map(async (tab) => {
    if (sortKey.selector) {
      return extractValueFromTab(
        tab.id,
        sortKey.selector,
        sortKey.attribute,
        sortKey.parseAs
      );
    } else {
      // No selector provided - return null value
      return {
        tabId: tab.id,
        value: null,
        error: 'No selector provided'
      };
    }
  });

  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        tabId: tabs[index].id,
        value: null,
        diagnostics: {
          notes: 'Extraction failed: ' + result.reason
        }
      };
    }
  });
}