import { ParseType } from './utils/parsing';

export type SiteProfile = {
  id: string;
  label: string;
  domainPattern: string;
  selector: string;
  attribute?: string;
  parseAs?: ParseType;
};

export type SortKey = {
  id: string;
  label: string;
  selector?: string;
  attribute?: string;
  parseAs?: ParseType;
  direction: "asc" | "desc";
  comparatorJS?: string;
};

export type Settings = {
  urlRegex?: string;
  keepPinnedStatic: boolean;
  missingValuePolicy: "last" | "first" | "error";
  siteProfiles: SiteProfile[];
  savedSortKeys: SortKey[];
};

export type ExtractedValue = {
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
};

export type TabInfo = {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  index: number;
  pinned: boolean;
  windowId: number;
  groupId?: number;
};

export type SortResult = {
  tabs: Array<TabInfo & { extractedValue?: any; rawText?: string }>;
  errors: Array<{
    tabId: number;
    error: string;
    code?: string;
    tabTitle?: string;
    tabUrl?: string;
  }>;
};

// Message types moved to ./types/messages.ts for better organization
export * from './types/messages';