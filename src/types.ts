export type SiteProfile = {
  id: string;
  label: string;
  domainPattern: string;
  selector: string;
  attribute?: string;
  parseAs?: "number" | "price" | "date" | "text";
};

export type SortKey = {
  id: string;
  label: string;
  selector?: string;
  attribute?: string;
  parseAs?: "number" | "price" | "date" | "text";
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
  tabs: Array<TabInfo & { extractedValue?: any }>;
  errors: Array<{
    tabId: number;
    error: string;
    tabTitle?: string;
    tabUrl?: string;
  }>;
};

export type MessageType =
  | { type: "EXTRACT_VALUE"; selector: string; attribute?: string; parseAs?: string }
  | { type: "GET_CONTEXT_TARGET" }
  | { type: "CLEAR_CONTEXT_TARGET" };

export type MessageResponse =
  | ExtractedValue
  | { selector: string; value: any }
  | null;