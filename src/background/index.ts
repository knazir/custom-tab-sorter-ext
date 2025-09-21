import { getSettings } from './config';
import { injectContentScript } from './messaging';
import { SortKey } from '../types';
import { RuntimeMessage, ContextMenuData } from '../types/messages';
import { handleMessage } from './messageHandlers';
import { performSort } from './sortOperations';
import { CONTEXT_MENU_IDS, BADGE, TIMEOUTS, STORAGE_KEYS } from '../config/constants';
import { detectParseType } from '../utils/parsing';
import { logError } from '../utils/errors';

chrome.runtime.onInstalled.addListener(() => {
  // Create parent menu
  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.PARENT,
    title: 'Tab Sorter',
    contexts: ['page', 'selection', 'link', 'image']
  });

  // Auto sort option
  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.AUTO_SORT,
    parentId: CONTEXT_MENU_IDS.PARENT,
    title: 'Quick sort by this value',
    contexts: ['page', 'selection', 'link', 'image']
  });

  // Configure in popup option
  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.CONFIGURE_SORT,
    parentId: CONTEXT_MENU_IDS.PARENT,
    title: 'Configure sort with this field...',
    contexts: ['page', 'selection', 'link', 'image']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_IDS.AUTO_SORT && tab?.id && tab?.url) {
    await handleAutoSort(tab.id, tab.url);
  } else if (info.menuItemId === CONTEXT_MENU_IDS.CONFIGURE_SORT && tab?.id && tab?.url) {
    await handleConfigureSort(tab.id, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  // Use centralized message handler
  handleMessage(message, sendResponse);
  return true; // Always return true for async response
});

// Helper functions for UI interactions

function setBadge(config: typeof BADGE[keyof typeof BADGE], duration?: number) {
  chrome.action.setBadgeText({ text: config.text });
  chrome.action.setBadgeBackgroundColor({ color: config.color });

  if (duration) {
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, duration);
  }
}

async function handleAutoSort(tabId: number, tabUrl: string) {
  const injected = await injectContentScript(tabId);

  if (!injected) {
    // Show warning badge for protected pages
    setBadge(BADGE.WARNING, TIMEOUTS.BADGE_ERROR_DISPLAY);
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
    const parseAs = response.value ? detectParseType(String(response.value).trim()) : 'text';

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
      setBadge(BADGE.SUCCESS, TIMEOUTS.BADGE_DISPLAY);
    } catch (error) {
      // Show error badge
      setBadge(BADGE.ERROR, TIMEOUTS.BADGE_ERROR_DISPLAY);
    }
  }
}

async function handleConfigureSort(tabId: number, tabUrl: string) {
  const injected = await injectContentScript(tabId);

  if (!injected) {
    // Show warning badge for protected pages
    setBadge(BADGE.WARNING, TIMEOUTS.BADGE_ERROR_DISPLAY);
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

    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXT_MENU_DATA]: contextData });

    // Clear the context target
    await chrome.tabs.sendMessage(tabId, {
      type: 'CLEAR_CONTEXT_TARGET'
    });

    // Set a badge to indicate data is ready
    setBadge(BADGE.DATA_READY);
  }
}

// Context menu handlers remain in this file as they interact with UI elements directly