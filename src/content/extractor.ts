import { ExtractedValue, MessageType } from '../types';

chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  if (message.type === 'EXTRACT_VALUE') {
    const result = extractValue(
      message.selector,
      message.attribute,
      message.parseAs
    );
    sendResponse(result);
    return true;
  }

  if (message.type === 'AUTO_DETECT') {
    const result = autoDetectValue();
    sendResponse(result);
    return true;
  }

  return false;
});

function extractValue(
  selector: string,
  attribute?: string,
  parseAs?: string
): ExtractedValue {
  try {
    const element = document.querySelector(selector);

    if (!element) {
      return {
        tabId: -1,
        value: null,
        diagnostics: {
          notes: `No element found for selector: ${selector}`
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

function autoDetectValue(): ExtractedValue {
  const detectors = [
    detectRating,
    detectPrice,
    detectDate,
    detectText
  ];

  for (const detector of detectors) {
    const result = detector();
    if (result && result.value !== null) {
      return result;
    }
  }

  return {
    tabId: -1,
    value: null,
    diagnostics: {
      notes: 'No value detected automatically'
    }
  };
}

function detectRating(): ExtractedValue | null {
  const selectors = [
    '[itemprop="ratingValue"]',
    '[aria-label*="rating" i]',
    '[class*="rating" i]:not([class*="count" i])',
    '[data-testid*="rating" i]',
    '[data-rating]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = (element as HTMLElement).textContent || '';
      const match = text.match(/(\d+(?:\.\d+)?)/);

      if (match) {
        const value = parseFloat(match[1]);
        if (value >= 0 && value <= 10) {
          return {
            tabId: -1,
            value: text,
            rawText: text,
            confidence: 0.9,
            diagnostics: {
              rule: 'Rating detection',
              parsed: value
            }
          };
        }
      }
    }
  }

  return null;
}

function detectPrice(): ExtractedValue | null {
  const selectors = [
    '[itemprop="price"]',
    '[class*="price" i]:not([class*="old" i]):not([class*="strike" i])',
    '[data-price]',
    '[id*="price" i]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      let text = (element as HTMLElement).textContent || '';

      const priceAttribute = element.getAttribute('data-price') ||
                           element.getAttribute('content');
      if (priceAttribute) {
        text = priceAttribute;
      }

      const priceMatch = text.match(/[\$£€¥]?\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/);

      if (priceMatch) {
        return {
          tabId: -1,
          value: text,
          rawText: text,
          confidence: 0.85,
          diagnostics: {
            rule: 'Price detection',
            parsed: priceMatch[0]
          }
        };
      }
    }
  }

  return null;
}

function detectDate(): ExtractedValue | null {
  const timeElement = document.querySelector('time[datetime]');
  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      return {
        tabId: -1,
        value: datetime,
        rawText: (timeElement as HTMLElement).textContent || datetime,
        confidence: 0.95,
        diagnostics: {
          rule: 'Date detection (time element)',
          parsed: datetime
        }
      };
    }
  }

  const dateSelectors = [
    '[class*="date" i]',
    '[data-date]',
    '[itemprop="datePublished"]',
    '[itemprop="dateModified"]'
  ];

  for (const selector of dateSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = (element as HTMLElement).textContent || '';
      const dateAttribute = element.getAttribute('data-date') ||
                           element.getAttribute('content');

      const value = dateAttribute || text;

      if (value && isValidDateString(value)) {
        return {
          tabId: -1,
          value,
          rawText: text,
          confidence: 0.8,
          diagnostics: {
            rule: 'Date detection',
            parsed: value
          }
        };
      }
    }
  }

  return null;
}

function detectText(): ExtractedValue | null {
  const h1 = document.querySelector('h1');
  if (h1) {
    const text = (h1 as HTMLElement).textContent?.trim();
    if (text) {
      return {
        tabId: -1,
        value: text,
        rawText: text,
        confidence: 0.5,
        diagnostics: {
          rule: 'Text fallback (H1)',
          parsed: text
        }
      };
    }
  }

  return null;
}

function isValidDateString(str: string): boolean {
  const date = new Date(str);
  return !isNaN(date.getTime());
}