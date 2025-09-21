// Content script for extracting values from DOM elements
// Must be self-contained - no external imports for Chrome extension compatibility

// Type definitions (inline for content script)
type ParseType = "number" | "price" | "date" | "text";

interface ExtractedValue {
  tabId: number;
  value: any;
  rawText?: string;
  confidence?: number;
  diagnostics?: {
    rule?: string;
    parsed?: any;
    notes?: string;
    selector?: string;
  };
}

interface ExtractValueMessage {
  type: 'EXTRACT_VALUE';
  selector: string;
  attribute?: string;
  parseAs?: ParseType;
}

// Message listener
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  if (message.type === 'EXTRACT_VALUE') {
    const result = extractValue(
      message.selector,
      message.attribute,
      message.parseAs
    );
    sendResponse(result);
    return true;
  }

  return false;
});

function extractValue(
  selector: string,
  attribute?: string,
  parseAs?: ParseType
): ExtractedValue {
  try {
    // Validate selector first
    if (!selector || selector.trim() === '') {
      return {
        tabId: -1,
        value: null,
        diagnostics: {
          notes: 'No selector provided',
          selector: ''
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
          notes: `Invalid CSS selector: "${selector}"`,
          selector
        }
      };
    }

    if (!element) {
      return {
        tabId: -1,
        value: null,
        diagnostics: {
          notes: `Element not found with selector: "${selector}"`,
          selector
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
        parsed: rawText,
        selector
      }
    };
  } catch (error) {
    return {
      tabId: -1,
      value: null,
      diagnostics: {
        notes: `Error extracting value: ${error}`,
        selector
      }
    };
  }
}