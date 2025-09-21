import { ExtractedValue } from '../types';
import { ContentScriptMessage, isExtractValueMessage } from '../types/messages';
import { ErrorFactory, isProtectedUrl, logError } from '../utils/errors';
import { CONTENT_SCRIPTS } from '../config/constants';
import { ParseType } from '../utils/parsing';

export async function sendMessageToTab<T = any>(
  tabId: number,
  message: ContentScriptMessage
): Promise<T | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as T;
  } catch (error) {
    logError(`Failed to send message to tab ${tabId}`, error);
    return null;
  }
}

export async function extractValueFromTab(
  tabId: number,
  selector: string,
  attribute?: string,
  parseAs?: ParseType
): Promise<ExtractedValue> {
  try {
    // Check if tab is loaded
    const tab = await chrome.tabs.get(tabId);

    if (tab.status === 'unloaded' || tab.discarded) {
      return {
        tabId,
        value: null,
        diagnostics: { notes: ErrorFactory.tabNotLoaded(tabId).message }
      };
    }

    const injected = await injectContentScript(tabId);

    if (!injected) {
      return {
        tabId,
        value: null,
        diagnostics: { notes: ErrorFactory.tabProtected(tabId, tab.url).message }
      };
    }

    const message: ContentScriptMessage = {
      type: 'EXTRACT_VALUE',
      selector,
      attribute,
      parseAs
    };

    const response = await sendMessageToTab<ExtractedValue>(tabId, message);

    if (!response || typeof response !== 'object') {
      return {
        tabId,
        value: null,
        diagnostics: { notes: 'Failed to extract value' }
      };
    }

    // Ensure the tabId is set correctly
    response.tabId = tabId;
    return response;
  } catch (error) {
    logError(`Failed to extract value from tab ${tabId}`, error);
    return {
      tabId,
      value: null,
      diagnostics: { notes: `Extraction error: ${error}` }
    };
  }
}


export async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    // Check if we can access the tab first
    const tab = await chrome.tabs.get(tabId);

    // Skip protected URLs
    if (!tab.url || isProtectedUrl(tab.url)) {
      logError(`Protected URL for tab ${tabId}`, tab.url);
      return false;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPTS.EXTRACTOR]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPTS.CONTEXT_TARGET]
    });

    return true;
  } catch (error) {
    logError(`Failed to inject content script to tab ${tabId}`, error);
    return false;
  }
}