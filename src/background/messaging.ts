import { ExtractedValue, MessageType, MessageResponse } from '../types';

export async function sendMessageToTab(
  tabId: number,
  message: MessageType
): Promise<MessageResponse> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    console.error(`Failed to send message to tab ${tabId}:`, error);
    return null;
  }
}

export async function extractValueFromTab(
  tabId: number,
  selector: string,
  attribute?: string,
  parseAs?: string
): Promise<ExtractedValue> {
  // Check if tab is loaded
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'unloaded' || tab.discarded) {
    return {
      tabId,
      value: null,
      diagnostics: { notes: 'Tab not loaded (discarded)' }
    };
  }

  const injected = await injectContentScript(tabId);

  if (!injected) {
    return {
      tabId,
      value: null,
      diagnostics: { notes: 'Protected page' }
    };
  }

  const response = await sendMessageToTab(tabId, {
    type: 'EXTRACT_VALUE',
    selector,
    attribute,
    parseAs
  });

  if (!response || typeof response !== 'object') {
    return {
      tabId,
      value: null,
      diagnostics: { notes: 'Failed to extract value' }
    };
  }

  // Ensure the tabId is set correctly
  const extractedValue = response as ExtractedValue;
  extractedValue.tabId = tabId;
  return extractedValue;
}


export async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    // Check if we can access the tab first
    const tab = await chrome.tabs.get(tabId);

    // Skip protected URLs
    if (!tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.includes('chrome.google.com/webstore')) {
      console.log(`Skipping protected tab ${tabId}: ${tab.url}`);
      return false;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content/extractor.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content/context-target.js']
    });

    return true;
  } catch (error) {
    console.warn(`Cannot access tab ${tabId}:`, error);
    return false;
  }
}