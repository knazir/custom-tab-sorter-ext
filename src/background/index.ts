import { getSettings, saveSettings } from './config';
import { getTargetTabs, moveTabs, focusTab } from './tabs';
import { createComparator, stableSort, TabWithValue } from './sorting';
import { extractValueFromTab, autoDetectValueFromTab, injectContentScript } from './messaging';
import { Settings, SortKey, SortResult, ExtractedValue } from '../types';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sort-by-element',
    title: 'Sort tabs by this field',
    contexts: ['page', 'selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'sort-by-element' && tab?.id) {
    await handleContextMenuSort(tab.id);
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

  return false;
});

async function handleContextMenuSort(tabId: number) {
  await injectContentScript(tabId);

  const response = await chrome.tabs.sendMessage(tabId, {
    type: 'GET_CONTEXT_TARGET'
  });

  if (response?.selector) {
    const settings = await getSettings();
    const sortKey: SortKey = {
      id: `context-${Date.now()}`,
      label: 'Context Menu Selection',
      selector: response.selector,
      direction: 'asc',
      parseAs: 'text'
    };

    const result = await performSort(
      settings.scope,
      settings.urlRegex,
      [sortKey],
      settings.keepPinnedStatic,
      settings.missingValuePolicy
    );

    await chrome.tabs.sendMessage(tabId, {
      type: 'CLEAR_CONTEXT_TARGET'
    });

    chrome.runtime.sendMessage({
      type: 'SORT_COMPLETE',
      result
    });
  }
}

async function handleSortRequest(message: any): Promise<SortResult> {
  const { scope, urlRegex, sortKeys, keepPinnedStatic, missingValuePolicy } = message;

  return performSort(
    scope,
    urlRegex,
    sortKeys,
    keepPinnedStatic,
    missingValuePolicy
  );
}

async function handlePreviewRequest(message: any): Promise<SortResult> {
  const { scope, urlRegex, sortKeys, missingValuePolicy } = message;

  const tabs = await getTargetTabs(scope, urlRegex);
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
    .map(e => ({
      tabId: e.tabId,
      error: e.diagnostics?.notes || 'Failed to extract value'
    }));

  return { tabs: sortedTabs, errors };
}

async function performSort(
  scope: 'currentWindow' | 'allWindows',
  urlRegex: string | undefined,
  sortKeys: SortKey[],
  keepPinnedStatic: boolean,
  missingValuePolicy: 'last' | 'first' | 'error'
): Promise<SortResult> {
  const tabs = await getTargetTabs(scope, urlRegex);
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
    .map(e => ({
      tabId: e.tabId,
      error: e.diagnostics?.notes || 'Failed to extract value'
    }));

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
      return autoDetectValueFromTab(tab.id);
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