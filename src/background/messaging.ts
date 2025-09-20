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
  console.log(`[extractValueFromTab] Starting extraction for tab ${tabId}`);
  console.log(`[extractValueFromTab] Selector: ${selector}, parseAs: ${parseAs}`);

  // Check if tab is loaded
  const tab = await chrome.tabs.get(tabId);
  console.log(`[extractValueFromTab] Tab status: ${tab.status}, discarded: ${tab.discarded}`);

  if (tab.status === 'unloaded' || tab.discarded) {
    console.log(`[extractValueFromTab] Tab ${tabId} is not loaded`);
    return {
      tabId,
      value: null,
      diagnostics: { notes: 'Tab not loaded (discarded)' }
    };
  }

  const injected = await injectContentScript(tabId);
  console.log(`[extractValueFromTab] Content script injection result: ${injected}`);

  if (!injected) {
    console.log(`[extractValueFromTab] Could not inject into tab ${tabId}`);
    return {
      tabId,
      value: null,
      diagnostics: { notes: 'Protected page' }
    };
  }

  const message = {
    type: 'EXTRACT_VALUE',
    selector,
    attribute,
    parseAs
  };
  console.log(`[extractValueFromTab] Sending message to tab:`, message);

  const response = await sendMessageToTab(tabId, message as any);
  console.log(`[extractValueFromTab] Response from tab:`, response);

  if (!response || typeof response !== 'object') {
    console.log(`[extractValueFromTab] Invalid response from tab ${tabId}`);
    return {
      tabId,
      value: null,
      diagnostics: { notes: 'Failed to extract value' }
    };
  }

  // Ensure the tabId is set correctly
  const extractedValue = response as ExtractedValue;
  extractedValue.tabId = tabId;
  console.log(`[extractValueFromTab] Final extracted value:`, extractedValue);
  return extractedValue;
}


export async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    console.log(`[injectContentScript] Attempting to inject into tab ${tabId}`);
    // Check if we can access the tab first
    const tab = await chrome.tabs.get(tabId);
    console.log(`[injectContentScript] Tab URL: ${tab.url}`);

    // Skip protected URLs
    if (!tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.includes('chrome.google.com/webstore')) {
      console.log(`[injectContentScript] Skipping protected tab ${tabId}: ${tab.url}`);
      return false;
    }

    console.log(`[injectContentScript] Injecting extractor.js`);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content/extractor.js']
    });

    console.log(`[injectContentScript] Injecting context-target.js`);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content/context-target.js']
    });

    console.log(`[injectContentScript] Successfully injected scripts into tab ${tabId}`);
    return true;
  } catch (error) {
    console.warn(`[injectContentScript] Cannot access tab ${tabId}:`, error);
    return false;
  }
}