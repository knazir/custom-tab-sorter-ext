interface TabSorterWindow extends Window {
  __tabSorter_lastContextTarget?: {
    selector: string;
    value: any;
  };
}

declare const window: TabSorterWindow;

let lastContextElement: Element | null = null;

document.addEventListener('contextmenu', (event) => {
  const target = event.target as Element;
  if (target) {
    lastContextElement = target;
    const selector = generateSelector(target);
    const value = (target as HTMLElement).textContent?.trim();

    window.__tabSorter_lastContextTarget = {
      selector,
      value
    };
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONTEXT_TARGET') {
    const target = window.__tabSorter_lastContextTarget;
    sendResponse(target || null);
    return true;
  }

  if (message.type === 'CLEAR_CONTEXT_TARGET') {
    window.__tabSorter_lastContextTarget = undefined;
    lastContextElement = null;
    sendResponse({ success: true });
    return true;
  }

  return false;
});

function generateSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  // Helper to escape CSS selector special characters
  const escapeSelector = (str: string): string => {
    return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  };

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      // Escape the ID to handle special characters
      const escapedId = CSS.escape(current.id);
      selector = `#${escapedId}`;
      parts.unshift(selector);
      break;
    }

    const classes = Array.from(current.classList)
      .filter(cls => !cls.includes(':') && /^[a-zA-Z]/.test(cls))
      .map(cls => CSS.escape(cls))
      .slice(0, 2);

    if (classes.length > 0) {
      selector += '.' + classes.join('.');
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current!.tagName
      );

      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        if (index > 1) {
          selector += `:nth-of-type(${index})`;
        }
      }
    }

    parts.unshift(selector);

    if (parts.length >= 4) {
      break;
    }

    current = current.parentElement;
  }

  const generatedSelector = parts.join(' > ');

  try {
    const matches = document.querySelectorAll(generatedSelector);
    if (matches.length === 1 && matches[0] === element) {
      return generatedSelector;
    }
  } catch (e) {
    console.error('Invalid selector generated:', generatedSelector);
  }

  const uniqueAttributes = ['data-testid', 'data-id', 'aria-label', 'name'];
  for (const attr of uniqueAttributes) {
    const value = element.getAttribute(attr);
    if (value) {
      // Escape attribute value for use in selector
      const escapedValue = value.replace(/"/g, '\\"');
      const selector = `${element.tagName.toLowerCase()}[${attr}="${escapedValue}"]`;
      try {
        const matches = document.querySelectorAll(selector);
        if (matches.length === 1 && matches[0] === element) {
          return selector;
        }
      } catch (e) {
        continue;
      }
    }
  }

  return generatedSelector;
}