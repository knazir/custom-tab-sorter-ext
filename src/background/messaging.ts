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
  await injectContentScript(tabId);

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

  return response as ExtractedValue;
}

export async function autoDetectValueFromTab(
  tabId: number
): Promise<ExtractedValue> {
  await injectContentScript(tabId);

  const response = await sendMessageToTab(tabId, {
    type: 'AUTO_DETECT'
  });

  if (!response || typeof response !== 'object') {
    return {
      tabId,
      value: null,
      diagnostics: { notes: 'Auto-detection failed' }
    };
  }

  return response as ExtractedValue;
}

export async function injectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content/extractor.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content/context-target.js']
    });
  } catch (error) {
    console.error(`Failed to inject content script into tab ${tabId}:`, error);
  }
}