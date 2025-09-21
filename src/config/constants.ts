/**
 * Centralized configuration constants for the Tab Sorter extension
 */

/**
 * Timeout configurations in milliseconds
 */
export const TIMEOUTS = {
  /** Timeout for extracting value from a single tab */
  TAB_EXTRACTION: 5000,
  /** Global timeout for extracting from all tabs */
  GLOBAL_EXTRACTION: 20000,
  /** Timeout for loading a suspended tab */
  TAB_LOAD: 10000,
  /** Duration to display badge notifications */
  BADGE_DISPLAY: 2000,
  /** Duration to display error badges */
  BADGE_ERROR_DISPLAY: 3000,
  /** Delay between batch operations */
  BATCH_DELAY: 500,
  /** Delay after loading tabs before extraction */
  POST_LOAD_DELAY: 1500,
  /** Delay for UI updates */
  UI_UPDATE_DELAY: 10,
  /** Context menu data check delay */
  CONTEXT_MENU_CHECK_DELAY: 100,
} as const;

/**
 * Operational limits
 */
export const LIMITS = {
  /** Maximum concurrent content script injections */
  CONCURRENT_INJECTIONS: 8,
  /** Batch size for loading suspended tabs */
  TAB_LOAD_BATCH_SIZE: 3,
  /** Maximum CSS classes to use in selector generation */
  MAX_SELECTOR_CLASSES: 2,
  /** Maximum depth for selector generation */
  MAX_SELECTOR_DEPTH: 4,
  /** Maximum length for extracted value display */
  MAX_DISPLAY_LENGTH: 50,
  /** Maximum title length in error display */
  MAX_ERROR_TITLE_LENGTH: 50,
} as const;

/**
 * Protected URL patterns that cannot have content scripts injected
 */
export const PROTECTED_URL_PATTERNS = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'file://', // Local files need explicit permission
  'chrome.google.com/webstore', // Chrome Web Store is protected
] as const;

/**
 * Storage keys used throughout the extension
 */
export const STORAGE_KEYS = {
  /** Main settings storage */
  SETTINGS: 'settings',
  /** Popup form state */
  POPUP_FORM_STATE: 'popupFormState',
  /** Preview result cache */
  PREVIEW_RESULT: 'previewResult',
  /** Context menu data */
  CONTEXT_MENU_DATA: 'contextMenuData',
  /** Popup theme preference */
  POPUP_THEME: 'popupTheme',
  /** App state (for future unified state) */
  APP_STATE: 'appState',
} as const;

/**
 * Context menu IDs
 */
export const CONTEXT_MENU_IDS = {
  PARENT: 'tab-sorter-parent',
  AUTO_SORT: 'auto-sort-by-element',
  CONFIGURE_SORT: 'configure-sort-by-element',
} as const;

/**
 * Badge configurations
 */
export const BADGE = {
  SUCCESS: { text: '✓', color: '#10b981' },
  ERROR: { text: '!', color: '#ef4444' },
  WARNING: { text: '⚠', color: '#f59e0b' },
  DATA_READY: { text: '•', color: '#667eea' },
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  PARSE_TYPE: 'text' as const,
  SORT_DIRECTION: 'asc' as const,
  MISSING_VALUE_POLICY: 'last' as const,
  KEEP_PINNED_STATIC: true,
} as const;

/**
 * Unique attributes to check for selector generation
 */
export const SELECTOR_UNIQUE_ATTRIBUTES = [
  'data-testid',
  'data-id',
  'aria-label',
  'name',
] as const;

/**
 * File paths for content scripts
 */
export const CONTENT_SCRIPTS = {
  EXTRACTOR: 'dist/content/extractor.js',
  CONTEXT_TARGET: 'dist/content/context-target.js',
} as const;