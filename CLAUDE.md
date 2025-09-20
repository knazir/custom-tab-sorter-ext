# CLAUDE.md — Tab Sorter (Chrome Extension)

> Agent role: **Senior Chrome Extension Engineer** using Claude Code. Plan changes first, confirm assumptions, then implement in small, testable PR-sized steps. All work is **local-only** (no network calls). Prefer readable TypeScript and clear separation between background (service worker), UI, and content scripts. Use modern best practices for Chrome extension development.

---

## 0) Mission & Non‑Goals

**Mission (v1):** Build a Manifest V3 Chrome extension that can **sort tabs** by a value scraped from each tab’s DOM. Support sorting across the **current window** or **all Chrome windows**, and optionally **filter the set of tabs by URL regex**. Support **manual one‑time sorting** (no live updates) and provide both:

* (A) **Physical reordering** of tabs in the browser window; and
* (B) A **visual list** (sorted) to navigate quickly.

**Non‑Goals (v1):**

* No cloud services or telemetry. No login/account. Local only.
* No continuous/background auto-sorting.
* No cross-browser support (Chrome first). Firefox-compatible code can be a future task.

---

## 1) Key Requirements (User‑Confirmed)

1. **Scope of tabs:**

   * Sort **all tabs in current window** *or* **all Chrome windows**.
   * Optional **include/exclude filter by URL regex**.
2. **Sort fields:**

   * Support **arbitrary fields**: ratings, prices, dates, text, etc. Not limited to well-known sites.
   * Also support **preconfigured site profiles** (e.g., IMDb, Goodreads, Amazon) and **saving custom selectors**.
3. **Sort key definition:**

   * Allow users to **enter a custom selector** (CSS selector preferred; XPath optional later).
   * Provide **auto-detect** mode to guess common fields (ratings/prices/dates) using heuristics.
4. **Outcomes:**

   * **Reorder tabs** physically using the Chrome Tabs API.
   * Show a **sorted list view** (with favicon, title, value) for quick jump.
5. **Triggering:**

   * Sorting is **manual** (explicit user action). No auto-refresh.
6. **Data extraction:**

   * Use **DOM scraping** via content scripts (not guaranteed structured data).
7. **Selecting a field:**

   * **Context menu action** on a page element: “Sort tabs by this field.”
   * **Registered custom selectors** in settings.
8. **Advanced sort functions (optional mode):**

   * e.g., **shortest title length**, **alphabetical by author**, **custom comparator** (JS expression) — gated under an “Advanced” UI.
9. **Multi-key sorting:**

   * Support **secondary/tertiary sort keys** with ASC/DESC per key.
10. **Permissions:**

* Extension may run **arbitrary content scripts across all tabs**; must be explicit about host permissions in MV3.

11. **Privacy:**

* **Entirely local.** No external API calls.

---

## 2) UX & Flows

### 2.1 Primary UI surfaces

* **Popup** (browser action): quick controls to choose **scope (window vs all)**, **URL regex**, **sort keys**, **ASC/DESC**, and to **Preview** or **Apply**.
* **List View** (extension page or popup tab): after extraction, show **sorted results**. Clicking an item **activates/focuses** that tab.
* **Options page**: manage **site profiles** (preconfigured + user-saved), **saved selectors**, **advanced comparators**, defaults (e.g., “keep pinned tabs static”).
* **Context menu**: right-click on an element → **“Use this element as sort key”**.

### 2.2 Typical flow (custom selector)

1. User opens popup → selects **scope** + (optional) **URL regex**.
2. Enters **CSS selector** (or chooses a saved profile).
3. Clicks **Preview** → extension injects content scripts, extracts values across tabs, and shows a **sorted preview list**.
4. User clicks **Apply** → tabs are **reordered** accordingly.

### 2.3 Typical flow (right‑click element)

1. On any page, user **right‑clicks** the element containing the value → context menu: **“Sort tabs by this field”**.
2. Extension records an element signature (robust selector) for that page/site, then runs the same **Preview → Apply** loop.

### 2.4 Error/edge cases

* **Missing value** on some tabs → show `—` and place at end by default (configurable).
* **Pinned tabs** → by default, keep relative order and position (**don’t move**). Optionally allow moving them.
* **Tab groups** → v1: **don’t create/destroy groups**; keep group membership. Sort within each group when scope=window (configurable future enhancement).
* **Service worker idle** → keep a **long-lived port** via the popup during extraction/sort to avoid premature shutdown.

---

## 3) Data Model & Config

```ts
// src/types.ts
export type Scope = "currentWindow" | "allWindows";

export type SiteProfile = {
  id: string;                // slug
  label: string;             // "IMDb rating"
  domainPattern: string;     // e.g. "*.imdb.com"
  selector: string;          // CSS selector to query
  attribute?: string;        // optional attribute (e.g., content)
  parseAs?: "number" | "price" | "date" | "text";
};

export type SortKey = {
  id: string;                // stable id for UI
  label: string;
  selector?: string;         // CSS selector (optional if using comparator)
  attribute?: string;        // e.g., data-* or content
  parseAs?: "number" | "price" | "date" | "text";
  direction: "asc" | "desc";
  // Advanced
  comparatorJS?: string;     // user-supplied JS comparator (advanced mode)
};

export type Settings = {
  scope: Scope;
  urlRegex?: string;         // filter tabs
  keepPinnedStatic: boolean; // default true
  missingValuePolicy: "last" | "first" | "error";
  siteProfiles: SiteProfile[];
  savedSortKeys: SortKey[];  // user-created presets
};
```

**Storage:** use `chrome.storage.local` with versioned schema and import/export JSON.

---

## 4) Architecture (MV3)

* **Background**: `service_worker` (TypeScript) orchestrates tab querying, script injection, extraction, sorting, and tab moves.
* **Content script**: reads DOM, computes values; supports both “selector query” and “auto-detect” heuristics.
* **Popup UI**: scope, filters, keys, preview/apply, progress.
* **Options page**: profiles/saved selectors, advanced comparators, defaults.
* **Context menu integration**: background registers a context menu; content script tracks **last right‑clicked element** via `contextmenu` event and exposes a **robust selector**.
* **Messaging**: use `chrome.runtime.sendMessage` + `chrome.tabs.sendMessage` and/or `chrome.runtime.connect` (long‑lived port) during extraction and sorting.

### 4.1 Manifest (baseline)

* **manifest\_version**: 3
* **permissions**: `"tabs", "scripting", "storage", "contextMenus"`
* **host\_permissions**: `"<all_urls>"` (required to scrape all tabs), or allow user to narrow to chosen hosts.
* **background**: `service_worker` entry
* **action**: popup page
* **options\_page**: HTML page for settings
* **content\_scripts**: optionally static for known domains (for right‑click tracking), but prefer **programmatic injection** (`chrome.scripting.executeScript`) on demand.

### 4.2 Core operations

1. **Collect target tabs** (`chrome.tabs.query`): scope + URL regex + window filter.
2. **Inject extractor** (`chrome.scripting.executeScript`): per tab.
3. **Extraction** (content script):

   * If **custom selector**: `querySelectorAll` → join or pick first. Apply `attribute` if provided. Parse according to `parseAs`.
   * If **auto-detect**: try heuristics for rating/price/date/text (see §5).
   * Return `{ tabId, value, diagnostics }`.
4. **Sort** in background: **stable multi-key** comparator with per-key ASC/DESC and missing-value policy.
5. **Preview UI**: show ordered list with titles, favicons, values, diagnostics.
6. **Apply**: batch `chrome.tabs.move` in ascending index order. Preserve pinned positioning if `keepPinnedStatic`.

---

## 5) DOM Extraction Heuristics (Auto‑Detect)

Heuristics should be conservative and explainable; run in this order, stop on first confident hit:

**Ratings** (0–5 or 0–10 typical):

* `[itemprop="ratingValue"]`, `[aria-label*="rating" i]`, `[class*="rating" i]`, `[data-testid*="rating" i]`.
* Extract numeric substring; clamp to plausible range.

**Prices**:

* `[itemprop=price]`, `[class*="price" i]`, `[data-price]`.
* Strip currency symbols and thousands separators; parse as float.

**Dates**:

* `time[datetime]`, `[class*="date" i]`, `[data-date]`.
* Prefer ISO `datetime`; else parse visible text with a small locale-agnostic parser; fallback: `Date.parse`.

**Text fallback**:

* If selector provided without `parseAs`, use textContent trimmed; case-insensitive compare.

Return a **confidence** score with notes (which rule matched, raw text, parsed value). In the UI, display diagnostics on hover to help users refine selectors.

---

## 6) Context Menu: “Sort by this element”

Implement via **two parts**:

1. **Content script** attaches `contextmenu` listener; on right-click, store a temporary **element fingerprint** (e.g., best-effort CSS selector path + attribute hint) in `window.__tabSorter_lastContextTarget`.
2. Background adds a `contextMenus` item for `page`/`selection`. When clicked, it messages the content script to extract a **value function** from the stored target (derive a robust selector if possible), then uses it as the **sort key** for all tabs of the same domain (or for all tabs, per user’s scope). If multiple elements per page, prefer the **closest unique selector**.

Robust selector strategy: build from ids/classes/data-\* with minimal specificity; avoid brittle nth-child chains when possible.

---

## 7) Sorting Semantics

* **Stable sort** with **multi-key** comparator `K1, K2, ...`.
* Each key has `direction` and `parseAs` semantics.
* **Missing values**: default policy `last` (place NaN/undefined after real values), configurable.
* **Case-insensitive** for text keys; locale-aware `Intl.Collator`.
* **Numeric tolerance**: treat `3.9` \~ `3.90` as equal.

---

## 8) Project Structure

```
/ (root)
  package.json
  vite.config.ts                     # if bundling TS
  /src
    /background
      index.ts                       # service worker
      sorting.ts                     # comparators, stable sort
      tabs.ts                        # query/filter/move helpers
      messaging.ts                   # types + utils
      config.ts                      # storage schema + defaults
    /content
      extractor.ts                   # selector-based + heuristics
      context-target.ts              # capture right-click target
    /ui
      /popup
        index.html
        main.tsx
        Popup.tsx
      /options
        index.html
        main.tsx
        OptionsPage.tsx
      /components
        ListView.tsx                 # preview/apply list
        SortKeyEditor.tsx
    /types.ts
    /site-profiles
      defaults.json                  # preconfigs (IMDb, Goodreads, etc.)
  /test
    extractor.spec.ts                # jsdom-based unit tests for parsing
    sorting.spec.ts
  manifest.json
  README.md
```

* Use minimal React for UI (Popup/Options) or keep it vanilla if preferred. Keep bundle small.

---

## 9) Manifest (draft)

```json
{
  "manifest_version": 3,
  "name": "Tab Sorter — DOM Field Sort",
  "version": "0.1.0",
  "action": { "default_popup": "src/ui/popup/index.html" },
  "options_page": "src/ui/options/index.html",
  "background": { "service_worker": "src/background/index.js", "type": "module" },
  "permissions": ["tabs", "scripting", "storage", "contextMenus"],
  "host_permissions": ["<all_urls>"],
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "128": "icons/128.png" }
}
```

> Note: for production, consider narrowing `host_permissions` to user-selected hosts to reduce prompts.

---

## 10) Implementation Plan (ask‑then‑build)

**Always start with a short plan in the terminal** (“plan, then execute”). Confirm ambiguities before coding.

1. **Scaffold** MV3 project (TS + Vite bundling or plain TS with esbuild) with manifest + background/popup/options/content skeletons.
2. **Tabs & scope**: implement tab discovery and URL-regex filtering. Unit‑test URL filter.
3. **Content injection**: create `extractor.ts` and message protocol. Implement selector-based extraction.
4. **Sorting core**: stable multi-key comparator + missing policy. Unit tests.
5. **Preview UI**: list with favicon/title/value; jump-to-tab.
6. **Apply move**: move in batches; preserve pinned order by default.
7. **Auto-detect heuristics**: rating/price/date passes with confidence + diagnostics.
8. **Context menu flow**: right‑click → content captures target → background triggers extraction/sort.
9. **Options page**: site profiles CRUD, saved sort-key presets, advanced comparator (JS expression with sandboxing), defaults.
10. **Polish**: error states, progress indicator, timeouts per tab, cancel button, i18n-ready labels.

Deliver each step as a separate PR-sized change. Keep commits small and documented.

---

## 11) Testing Strategy

* **Unit tests** (Vitest/Jest) for:

  * DOM extraction (jsdom): selectors, attribute reads, parsers for number/price/date/text.
  * Heuristic detection (sample HTML snippets).
  * Sorting comparators and multi-key ordering.
* **Manual QA**: use Chrome’s “Load unpacked” → exercise popup, context menu, options. Test with 10–100 tabs across mixed sites. Verify pinned handling and group preservation.
* **Performance**: cap concurrent injections (e.g., 8–12 at a time). Use `Promise.allSettled`. Show progress.

---

## 12) Security & Privacy

* No remote calls. No analytics. All data in `chrome.storage.local`.
* Sanitize user-provided **JS comparator** (advanced mode): run in a **restricted sandbox** (e.g., `Function("a","b", body)` with strict allowlist) or gate behind prominent warning; v1 may omit free-form comparator and only offer built-in advanced functions.
* Use least-privilege host permissions where possible.

---

## 13) Defaults & Preconfigured Site Profiles (starter examples)

* **IMDb rating**: `selector: '[data-testid="hero-rating-bar__aggregate-rating__score"]'`, `parseAs: 'number'` (extract numeric substring).
* **Goodreads rating**: `selector: '[itemprop="ratingValue"]'`, `parseAs: 'number'`.
* **Amazon price**: `selector: '#priceblock_ourprice, #priceblock_dealprice, [data-a-color="price"]'`, `parseAs: 'price'`.
* **Steam user score**: `selector: '.game_review_summary'`, `parseAs: 'text'` → map adjectives to numeric if desired.

(These are best-effort and may require per-site tweaks; keep editable in options.)

---

## 14) Developer UX for Claude Code

* **Ask-first policy**: If any requirement is ambiguous (e.g., how to handle ties, pinned tabs, tab groups), print a short clarification question before coding.
* **Plan mode**: Output a concise **file-by-file plan** before making edits. Keep deltas tight.
* **Readable TS**: Strong types, small pure functions (`parsePrice`, `extractNumeric`, etc.).
* **Diagnostics**: Return `{ rawText, parsed, rule, confidence }` for transparency.
* **Idempotence**: Sorting should be idempotent; applying again should not shuffle equal items unpredictably.

---

## 15) Definition of Done (v1)

* Can **sort current window** or **all windows** by a **custom selector** or **auto-detected field**.
* Can **preview** results and **apply** to reorder tabs.
* **Context menu** path works to pick an element on a page and use it as a sort key.
* **Saved profiles** and **saved sort keys** persisted; import/export works.
* **Pinned tabs** preserved by default; missing values handled per setting.
* Basic unit tests passing; manual QA checklist completed.
* No external network requests.

---

## 16) Future Enhancements

* Multi-window **visual board** for drag-to-reorder before applying.
* **XPath** selectors and more robust selector generator.
* **Tab groups** aware sorting and group reflow.
* **AI-assisted selector suggestions** (still local-only: optional rule-based assistant or on-device model when/if feasible).
* **Keyboard shortcuts** (commands API) to re-run last sort.

---

## 17) Quick Commands (for Claude Code)

* **Bootstrap**: create manifest + TS scaffold; set up build (Vite/esbuild) outputting MV3-compatible files.
* **Implement**: background extraction/sorting, content script, popup, options, context menu.
* **Test**: add jsdom tests for parsers/heuristics; manual QA notes in README.
* **Ship**: ensure icons, names, permissions prompts are clear; document privacy.

> When ready, present a short **execution plan** and start with the scaffold PR.
