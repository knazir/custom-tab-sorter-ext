/**
 * Message types for communication between extension components
 */

import { Settings, SortKey, SortResult, ExtractedValue } from '../types';
import { ParseType } from '../utils/parsing';

// Request Messages

export interface SortTabsMessage {
  type: 'SORT_TABS';
  urlRegex?: string;
  sortKeys: SortKey[];
  keepPinnedStatic: boolean;
  missingValuePolicy: 'last' | 'first' | 'error';
}

export interface PreviewSortMessage {
  type: 'PREVIEW_SORT';
  urlRegex?: string;
  sortKeys: SortKey[];
  missingValuePolicy: 'last' | 'first' | 'error';
}

export interface FocusTabMessage {
  type: 'FOCUS_TAB';
  tabId: number;
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface SaveSettingsMessage {
  type: 'SAVE_SETTINGS';
  settings: Partial<Settings>;
}

export interface GetContextDataMessage {
  type: 'GET_CONTEXT_DATA';
}

export interface ClearContextDataMessage {
  type: 'CLEAR_CONTEXT_DATA';
}

export interface TestRegexMessage {
  type: 'TEST_REGEX';
  urlRegex?: string;
}

export interface TestSelectorMessage {
  type: 'TEST_SELECTOR';
  tabId: number;
  selector: string;
  parseAs?: ParseType;
}

export interface CheckUnloadedTabsMessage {
  type: 'CHECK_UNLOADED_TABS';
  urlRegex?: string;
}

export interface LoadUnloadedTabsMessage {
  type: 'LOAD_UNLOADED_TABS';
  urlRegex?: string;
}

// Content Script Messages

export interface ExtractValueMessage {
  type: 'EXTRACT_VALUE';
  selector: string;
  attribute?: string;
  parseAs?: ParseType;
}

export interface GetContextTargetMessage {
  type: 'GET_CONTEXT_TARGET';
}

export interface ClearContextTargetMessage {
  type: 'CLEAR_CONTEXT_TARGET';
}

// Union of all message types
export type RuntimeMessage =
  | SortTabsMessage
  | PreviewSortMessage
  | FocusTabMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | GetContextDataMessage
  | ClearContextDataMessage
  | TestRegexMessage
  | TestSelectorMessage
  | CheckUnloadedTabsMessage
  | LoadUnloadedTabsMessage;

export type ContentScriptMessage =
  | ExtractValueMessage
  | GetContextTargetMessage
  | ClearContextTargetMessage;

export type Message = RuntimeMessage | ContentScriptMessage;

// Response Types

export interface SuccessResponse {
  success: true;
  data?: any;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export interface TestRegexResponse {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

export interface CheckUnloadedResponse {
  hasUnloaded: boolean;
  count: number;
  total: number;
  unloadedTabs?: Array<{
    id: number;
    title: string;
    url: string;
  }>;
}

export interface LoadUnloadedResponse {
  success: boolean;
  loadedCount: number;
  totalUnloaded?: number;
  errors?: string[];
  message: string;
}

export interface ContextMenuData {
  selector: string;
  value: any;
  urlRegex: string;
  sourceUrl: string;
  timestamp: number;
}

export interface ContextTargetInfo {
  selector: string;
  value: any;
}

// Message handler type
export type MessageHandler<T extends Message, R = any> = (
  message: T,
  sender: chrome.runtime.MessageSender
) => Promise<R> | R;

// Type guards

export function isSortTabsMessage(msg: any): msg is SortTabsMessage {
  return msg?.type === 'SORT_TABS';
}

export function isPreviewSortMessage(msg: any): msg is PreviewSortMessage {
  return msg?.type === 'PREVIEW_SORT';
}

export function isFocusTabMessage(msg: any): msg is FocusTabMessage {
  return msg?.type === 'FOCUS_TAB' && typeof msg?.tabId === 'number';
}

export function isExtractValueMessage(msg: any): msg is ExtractValueMessage {
  return msg?.type === 'EXTRACT_VALUE' && typeof msg?.selector === 'string';
}

export function isContentScriptMessage(msg: any): msg is ContentScriptMessage {
  return msg?.type === 'EXTRACT_VALUE' ||
         msg?.type === 'GET_CONTEXT_TARGET' ||
         msg?.type === 'CLEAR_CONTEXT_TARGET';
}