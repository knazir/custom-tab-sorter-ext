/**
 * Centralized storage management for the Tab Sorter extension
 */

import { Settings, SortResult } from '../types';
import { ContextMenuData } from '../types/messages';
import { STORAGE_KEYS, DEFAULTS } from '../config/constants';
import { logError } from '../utils/errors';

export interface PopupFormState {
  urlRegex: string;
  selector: string;
  parseAs: 'text' | 'number' | 'price' | 'date';
  direction: 'asc' | 'desc';
}

export interface AppState {
  settings: Settings;
  popupFormState?: PopupFormState;
  previewResult?: SortResult | null;
  contextMenuData?: ContextMenuData | null;
  popupTheme?: 'light' | 'dark';
}

// Default settings for initialization
const DEFAULT_SETTINGS: Settings = {
  keepPinnedStatic: DEFAULTS.KEEP_PINNED_STATIC,
  missingValuePolicy: DEFAULTS.MISSING_VALUE_POLICY,
  siteProfiles: [],
  savedSortKeys: []
};

const DEFAULT_APP_STATE: AppState = {
  settings: DEFAULT_SETTINGS,
  popupFormState: {
    urlRegex: '',
    selector: '',
    parseAs: DEFAULTS.PARSE_TYPE,
    direction: DEFAULTS.SORT_DIRECTION
  }
};

/**
 * Storage manager for unified state management
 */
export class StorageManager {
  private static instance: StorageManager;

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Get the entire app state
   */
  async getAppState(): Promise<AppState> {
    try {
      // Fetch all storage keys in parallel
      const [settings, popupForm, preview, contextData, theme] = await Promise.all([
        this.getSettings(),
        this.getPopupFormState(),
        this.getPreviewResult(),
        this.getContextMenuData(),
        this.getPopupTheme()
      ]);

      return {
        settings,
        popupFormState: popupForm,
        previewResult: preview,
        contextMenuData: contextData,
        popupTheme: theme
      };
    } catch (error) {
      logError('Failed to get app state', error);
      return DEFAULT_APP_STATE;
    }
  }

  /**
   * Save the entire app state
   */
  async saveAppState(state: Partial<AppState>): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      if (state.settings) {
        promises.push(this.saveSettings(state.settings));
      }
      if (state.popupFormState) {
        promises.push(this.savePopupFormState(state.popupFormState));
      }
      if (state.previewResult !== undefined) {
        promises.push(this.savePreviewResult(state.previewResult));
      }
      if (state.contextMenuData !== undefined) {
        promises.push(this.saveContextMenuData(state.contextMenuData));
      }
      if (state.popupTheme) {
        promises.push(this.savePopupTheme(state.popupTheme));
      }

      await Promise.all(promises);
    } catch (error) {
      logError('Failed to save app state', error);
      throw error;
    }
  }

  /**
   * Get settings
   */
  async getSettings(): Promise<Settings> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.SETTINGS] || {}) };
    } catch (error) {
      logError('Failed to get settings', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings
   */
  async saveSettings(settings: Partial<Settings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
    } catch (error) {
      logError('Failed to save settings', error);
      throw error;
    }
  }

  /**
   * Get popup form state
   */
  async getPopupFormState(): Promise<PopupFormState | undefined> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.POPUP_FORM_STATE);
      return stored[STORAGE_KEYS.POPUP_FORM_STATE];
    } catch (error) {
      logError('Failed to get popup form state', error);
      return undefined;
    }
  }

  /**
   * Save popup form state
   */
  async savePopupFormState(state: PopupFormState): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.POPUP_FORM_STATE]: state });
    } catch (error) {
      logError('Failed to save popup form state', error);
      throw error;
    }
  }

  /**
   * Get preview result
   */
  async getPreviewResult(): Promise<SortResult | null> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.PREVIEW_RESULT);
      return stored[STORAGE_KEYS.PREVIEW_RESULT] || null;
    } catch (error) {
      logError('Failed to get preview result', error);
      return null;
    }
  }

  /**
   * Save preview result
   */
  async savePreviewResult(result: SortResult | null): Promise<void> {
    try {
      if (result) {
        await chrome.storage.local.set({ [STORAGE_KEYS.PREVIEW_RESULT]: result });
      } else {
        await chrome.storage.local.remove(STORAGE_KEYS.PREVIEW_RESULT);
      }
    } catch (error) {
      logError('Failed to save preview result', error);
      throw error;
    }
  }

  /**
   * Get context menu data
   */
  async getContextMenuData(): Promise<ContextMenuData | null> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.CONTEXT_MENU_DATA);
      return stored[STORAGE_KEYS.CONTEXT_MENU_DATA] || null;
    } catch (error) {
      logError('Failed to get context menu data', error);
      return null;
    }
  }

  /**
   * Save context menu data
   */
  async saveContextMenuData(data: ContextMenuData | null): Promise<void> {
    try {
      if (data) {
        await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXT_MENU_DATA]: data });
      } else {
        await chrome.storage.local.remove(STORAGE_KEYS.CONTEXT_MENU_DATA);
      }
    } catch (error) {
      logError('Failed to save context menu data', error);
      throw error;
    }
  }

  /**
   * Clear context menu data
   */
  async clearContextMenuData(): Promise<void> {
    await this.saveContextMenuData(null);
  }

  /**
   * Get popup theme
   */
  async getPopupTheme(): Promise<'light' | 'dark' | undefined> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.POPUP_THEME);
      return stored[STORAGE_KEYS.POPUP_THEME];
    } catch (error) {
      logError('Failed to get popup theme', error);
      return undefined;
    }
  }

  /**
   * Save popup theme
   */
  async savePopupTheme(theme: 'light' | 'dark'): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.POPUP_THEME]: theme });
    } catch (error) {
      logError('Failed to save popup theme', error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  async clearAll(): Promise<void> {
    try {
      await chrome.storage.local.clear();
    } catch (error) {
      logError('Failed to clear storage', error);
      throw error;
    }
  }

  /**
   * Export all data as JSON
   */
  async exportData(): Promise<string> {
    const state = await this.getAppState();
    return JSON.stringify(state, null, 2);
  }

  /**
   * Import data from JSON
   */
  async importData(jsonStr: string): Promise<void> {
    try {
      const data = JSON.parse(jsonStr) as AppState;
      await this.saveAppState(data);
    } catch (error) {
      logError('Failed to import data', error);
      throw new Error('Invalid import data format');
    }
  }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance();