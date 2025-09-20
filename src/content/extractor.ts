import { ExtractedValue, MessageType } from '../types';

console.log('[Content Script] extractor.ts loaded');

chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  console.log('[Content Script] Received message:', message);

  if (message.type === 'EXTRACT_VALUE') {
    console.log('[Content Script] Processing EXTRACT_VALUE');
    const result = extractValue(
      message.selector,
      message.attribute,
      message.parseAs
    );
    console.log('[Content Script] Extraction result:', result);
    sendResponse(result);
    return true;
  }

  console.log('[Content Script] Unknown message type:', message.type);
  return false;
});

function extractValue(
  selector: string,
  attribute?: string,
  parseAs?: string
): ExtractedValue {
  try {
    // Validate selector first
    if (!selector || selector.trim() === '') {
      return {
        tabId: -1,
        value: null,
        diagnostics: {
          notes: 'No selector provided'
        }
      };
    }

    // Try to parse the selector to check if it's valid
    let element: Element | null;
    try {
      element = document.querySelector(selector);
    } catch (selectorError) {
      return {
        tabId: -1,
        value: null,
        diagnostics: {
          notes: `Invalid CSS selector: "${selector}"`
        }
      };
    }

    if (!element) {
      return {
        tabId: -1,
        value: null,
        diagnostics: {
          notes: `Element not found with selector: "${selector}"`
        }
      };
    }

    let rawText: string;

    if (attribute) {
      rawText = element.getAttribute(attribute) || '';
    } else {
      rawText = (element as HTMLElement).textContent || '';
    }

    rawText = rawText.trim();

    return {
      tabId: -1,
      value: rawText,
      rawText,
      confidence: 1.0,
      diagnostics: {
        rule: `Selector: ${selector}`,
        parsed: rawText
      }
    };
  } catch (error) {
    return {
      tabId: -1,
      value: null,
      diagnostics: {
        notes: `Error extracting value: ${error}`
      }
    };
  }
}

