/**
 * Centralized message handlers for the background script
 */

import {
  RuntimeMessage,
  SortTabsMessage,
  PreviewSortMessage,
  FocusTabMessage,
  GetSettingsMessage,
  SaveSettingsMessage,
  TestRegexMessage,
  TestSelectorMessage,
  CheckUnloadedTabsMessage,
  LoadUnloadedTabsMessage,
  ContextMenuData
} from '../types/messages';
import { SortResult } from '../types';
import { getSettings, saveSettings } from './config';
import { getTargetTabs, focusTab, getUnloadedTabs } from './tabs';
import { performSort, performPreview } from './sortOperations';
import { extractValueFromTab } from './messaging';
import { STORAGE_KEYS, TIMEOUTS, LIMITS } from '../config/constants';
import { logError, withErrorHandling } from '../utils/errors';

/**
 * Handle sort tabs request
 */
async function handleSortTabs(message: SortTabsMessage): Promise<SortResult> {
  return performSort(
    message.urlRegex,
    message.sortKeys,
    message.keepPinnedStatic,
    message.missingValuePolicy
  );
}

/**
 * Handle preview sort request
 */
async function handlePreviewSort(message: PreviewSortMessage): Promise<SortResult> {
  return performPreview(
    message.urlRegex,
    message.sortKeys,
    message.missingValuePolicy
  );
}

/**
 * Handle focus tab request
 */
async function handleFocusTab(message: FocusTabMessage): Promise<{ success: boolean }> {
  await focusTab(message.tabId);
  return { success: true };
}

/**
 * Handle get settings request
 */
async function handleGetSettings(_message: GetSettingsMessage) {
  return getSettings();
}

/**
 * Handle save settings request
 */
async function handleSaveSettings(message: SaveSettingsMessage): Promise<{ success: boolean }> {
  await saveSettings(message.settings);
  return { success: true };
}

/**
 * Handle get context data request
 */
async function handleGetContextData() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.CONTEXT_MENU_DATA);
  return data[STORAGE_KEYS.CONTEXT_MENU_DATA] || null;
}

/**
 * Handle clear context data request
 */
async function handleClearContextData(): Promise<{ success: boolean }> {
  await chrome.storage.local.remove(STORAGE_KEYS.CONTEXT_MENU_DATA);
  return { success: true };
}

/**
 * Handle test regex request
 */
async function handleTestRegex(message: TestRegexMessage) {
  const tabs = await getTargetTabs(message.urlRegex);
  return tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl
  }));
}

/**
 * Handle test selector request
 */
async function handleTestSelector(message: TestSelectorMessage) {
  return extractValueFromTab(
    message.tabId,
    message.selector,
    undefined,
    message.parseAs
  );
}

/**
 * Handle check unloaded tabs request
 */
async function handleCheckUnloadedTabs(message: CheckUnloadedTabsMessage) {
  const tabs = await getTargetTabs(message.urlRegex);
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

/**
 * Handle load unloaded tabs request
 */
async function handleLoadUnloadedTabs(message: LoadUnloadedTabsMessage) {
  const tabs = await getTargetTabs(message.urlRegex);
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

  // Load tabs in batches
  for (let i = 0; i < unloadedTabIds.length; i += LIMITS.TAB_LOAD_BATCH_SIZE) {
    const batch = unloadedTabIds.slice(i, i + LIMITS.TAB_LOAD_BATCH_SIZE);

    await Promise.all(batch.map(async (tabId) => {
      try {
        await chrome.tabs.reload(tabId);
        loadedCount++;
      } catch (error) {
        const tab = tabs.find(t => t.id === tabId);
        errors.push(`Failed to load tab: ${tab?.title || tabId}`);
        logError('Load tab', error);
      }
    }));

    // Small delay between batches
    if (i + LIMITS.TAB_LOAD_BATCH_SIZE < unloadedTabIds.length) {
      await new Promise(resolve => setTimeout(resolve, TIMEOUTS.BATCH_DELAY));
    }
  }

  // Wait for tabs to fully load
  await new Promise(resolve => setTimeout(resolve, TIMEOUTS.POST_LOAD_DELAY));

  return {
    success: loadedCount > 0,
    loadedCount,
    totalUnloaded: unloadedTabIds.length,
    errors,
    message: `Loaded ${loadedCount} of ${unloadedTabIds.length} suspended tabs`
  };
}

/**
 * Message handler map
 */
export const messageHandlers = {
  SORT_TABS: handleSortTabs,
  PREVIEW_SORT: handlePreviewSort,
  FOCUS_TAB: handleFocusTab,
  GET_SETTINGS: handleGetSettings,
  SAVE_SETTINGS: handleSaveSettings,
  GET_CONTEXT_DATA: handleGetContextData,
  CLEAR_CONTEXT_DATA: handleClearContextData,
  TEST_REGEX: handleTestRegex,
  TEST_SELECTOR: handleTestSelector,
  CHECK_UNLOADED_TABS: handleCheckUnloadedTabs,
  LOAD_UNLOADED_TABS: handleLoadUnloadedTabs,
} as const;

/**
 * Type-safe message handler
 */
export async function handleMessage(
  message: RuntimeMessage,
  sendResponse: (response: any) => void
): Promise<void> {
  const handler = messageHandlers[message.type as keyof typeof messageHandlers];

  if (!handler) {
    sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
    return;
  }

  try {
    const result = await handler(message as any);
    sendResponse(result);
  } catch (error) {
    logError(`Handler for ${message.type}`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}