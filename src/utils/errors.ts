/**
 * Standardized error handling for the Tab Sorter extension
 */

/**
 * Error codes for different failure scenarios
 */
export const ErrorCodes = {
  // Extraction errors
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  EXTRACTION_TIMEOUT: 'EXTRACTION_TIMEOUT',
  INVALID_SELECTOR: 'INVALID_SELECTOR',
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',

  // Tab errors
  TAB_PROTECTED: 'TAB_PROTECTED',
  TAB_NOT_LOADED: 'TAB_NOT_LOADED',
  TAB_DISCARDED: 'TAB_DISCARDED',
  TAB_NOT_FOUND: 'TAB_NOT_FOUND',

  // Parsing errors
  PARSE_ERROR: 'PARSE_ERROR',
  INVALID_VALUE: 'INVALID_VALUE',

  // Storage errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',

  // Message passing errors
  MESSAGE_SEND_FAILED: 'MESSAGE_SEND_FAILED',
  INVALID_MESSAGE_TYPE: 'INVALID_MESSAGE_TYPE',

  // Configuration errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_PERMISSION: 'MISSING_PERMISSION',

  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Custom error class for Tab Sorter specific errors
 */
export class TabSorterError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly tabId?: number,
    public readonly recoverable: boolean = true,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'TabSorterError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      tabId: this.tabId,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  tabId?: number;
  tabTitle?: string;
  tabUrl?: string;
  details?: any;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: Error | TabSorterError | string,
  tabInfo?: { id?: number; title?: string; url?: string }
): ErrorResponse {
  if (error instanceof TabSorterError) {
    return {
      error: error.message,
      code: error.code,
      tabId: error.tabId ?? tabInfo?.id,
      tabTitle: tabInfo?.title,
      tabUrl: tabInfo?.url,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      code: ErrorCodes.UNKNOWN_ERROR,
      tabId: tabInfo?.id,
      tabTitle: tabInfo?.title,
      tabUrl: tabInfo?.url,
    };
  }

  return {
    error: String(error),
    code: ErrorCodes.UNKNOWN_ERROR,
    tabId: tabInfo?.id,
    tabTitle: tabInfo?.title,
    tabUrl: tabInfo?.url,
  };
}

/**
 * Check if a URL is protected from content script injection
 */
export function isProtectedUrl(url: string): boolean {
  const protectedPatterns = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'chrome.google.com/webstore'
  ];

  return protectedPatterns.some(pattern => url.startsWith(pattern));
}

/**
 * Safe error logger that handles different error types
 */
export function logError(context: string, error: unknown): void {
  const timestamp = new Date().toISOString();

  if (error instanceof TabSorterError) {
    console.error(`[${timestamp}] ${context}:`, {
      message: error.message,
      code: error.code,
      tabId: error.tabId,
      recoverable: error.recoverable,
      details: error.details,
    });
  } else if (error instanceof Error) {
    console.error(`[${timestamp}] ${context}:`, {
      message: error.message,
      stack: error.stack,
    });
  } else {
    console.error(`[${timestamp}] ${context}:`, error);
  }
}

/**
 * Wrap an async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(context, error);

    if (fallback !== undefined) {
      return fallback;
    }

    throw error;
  }
}

/**
 * Create error for common scenarios
 */
export class ErrorFactory {
  static tabProtected(tabId: number, url?: string): TabSorterError {
    return new TabSorterError(
      `Cannot access protected page${url ? `: ${url}` : ''}`,
      ErrorCodes.TAB_PROTECTED,
      tabId,
      false
    );
  }

  static tabNotLoaded(tabId: number): TabSorterError {
    return new TabSorterError(
      'Tab not loaded (discarded)',
      ErrorCodes.TAB_NOT_LOADED,
      tabId,
      true
    );
  }

  static extractionTimeout(tabId: number): TabSorterError {
    return new TabSorterError(
      'Extraction timed out (tab may be loading)',
      ErrorCodes.EXTRACTION_TIMEOUT,
      tabId,
      true
    );
  }

  static invalidSelector(selector: string): TabSorterError {
    return new TabSorterError(
      `Invalid CSS selector: "${selector}"`,
      ErrorCodes.INVALID_SELECTOR,
      undefined,
      false,
      { selector }
    );
  }

  static elementNotFound(selector: string, tabId?: number): TabSorterError {
    return new TabSorterError(
      `Element not found with selector: "${selector}"`,
      ErrorCodes.ELEMENT_NOT_FOUND,
      tabId,
      true,
      { selector }
    );
  }

  static parseError(value: any, parseType: string): TabSorterError {
    return new TabSorterError(
      `Failed to parse value as ${parseType}`,
      ErrorCodes.PARSE_ERROR,
      undefined,
      false,
      { value, parseType }
    );
  }
}