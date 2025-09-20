import React, { useState, useEffect, useCallback } from 'react';
import { Settings, SortKey, SortResult } from '../../types';
import { ListView } from '../components/ListView';
import './popup.css';

interface PopupState {
  urlRegex: string;
  selector: string;
  parseAs: 'text' | 'number' | 'price' | 'date';
  direction: 'asc' | 'desc';
}

const POPUP_STATE_KEY = 'popupFormState';
const PREVIEW_RESULT_KEY = 'previewResult';

export function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [urlRegex, setUrlRegex] = useState('');
  const [selector, setSelector] = useState('');
  const [parseAs, setParseAs] = useState<'text' | 'number' | 'price' | 'date'>('text');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [previewResult, setPreviewResult] = useState<SortResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unloadedWarning, setUnloadedWarning] = useState<string | null>(null);
  const [unloadedTabCount, setUnloadedTabCount] = useState<number>(0);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [regexTestResult, setRegexTestResult] = useState<string | null>(null);
  const [regexTestLoading, setRegexTestLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Save state to storage whenever form values change
  const savePopupState = useCallback(async () => {
    const state: PopupState = {
      urlRegex,
      selector,
      parseAs,
      direction
    };
    await chrome.storage.local.set({ [POPUP_STATE_KEY]: state });
  }, [urlRegex, selector, parseAs, direction]);

  // Load saved state on mount
  useEffect(() => {
    loadSettings();
    loadPopupState();
    loadPreviewResult();
    loadTheme();
    // Delay context menu check to allow other state to settle
    setTimeout(() => {
      checkForContextMenuData();
    }, 100);
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    chrome.storage.local.set({ popupTheme: theme });
  }, [theme]);

  // Save state whenever form values change
  useEffect(() => {
    savePopupState();
  }, [savePopupState]);

  async function loadTheme() {
    // First check for saved theme preference
    const stored = await chrome.storage.local.get('popupTheme');
    if (stored.popupTheme) {
      setTheme(stored.popupTheme);
    } else {
      // Otherwise use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }

  function toggleTheme() {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }

  async function loadPopupState() {
    const stored = await chrome.storage.local.get(POPUP_STATE_KEY);
    if (stored[POPUP_STATE_KEY]) {
      const state = stored[POPUP_STATE_KEY] as PopupState;
      setUrlRegex(state.urlRegex);
      setSelector(state.selector);
      setParseAs(state.parseAs);
      setDirection(state.direction);
    }
  }

  async function loadPreviewResult() {
    const stored = await chrome.storage.local.get(PREVIEW_RESULT_KEY);
    if (stored[PREVIEW_RESULT_KEY]) {
      setPreviewResult(stored[PREVIEW_RESULT_KEY] as SortResult);
    }
  }

  async function savePreviewResult(result: SortResult | null) {
    if (result) {
      await chrome.storage.local.set({ [PREVIEW_RESULT_KEY]: result });
    } else {
      await chrome.storage.local.remove(PREVIEW_RESULT_KEY);
    }
  }

  async function checkForContextMenuData() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CONTEXT_DATA' });

    if (response && response.selector) {
      // Context menu data is available - auto-fill the form
      setSelector(response.selector);
      setUrlRegex(response.urlRegex || '');

      // Try to guess the parse type based on the value
      if (response.value) {
        const value = String(response.value).trim();

        // Check if it looks like a number
        if (/^\d+(\.\d+)?$/.test(value)) {
          setParseAs('number');
        }
        // Check if it looks like a price
        else if (/[\$£€¥]/.test(value) || /\d+[.,]\d{2}/.test(value)) {
          setParseAs('price');
        }
        // Check if it might be a date
        else if (/\d{4}-\d{2}-\d{2}/.test(value) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)) {
          setParseAs('date');
        }
        // Default to text
        else {
          setParseAs('text');
        }
      }

      // Clear the context data after using it
      await chrome.runtime.sendMessage({ type: 'CLEAR_CONTEXT_DATA' });

      // Clear the badge
      chrome.action.setBadgeText({ text: '' });

      // Show a subtle indicator that data was loaded from context menu
      setError(null);
      // Note: Auto-preview will happen after state updates
    }
  }

  async function loadSettings() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    setSettings(response);
  }

  async function handlePreview() {
    // Clear the old preview first to show visual feedback
    setPreviewResult(null);
    setError(null);
    setPreviewLoading(true);

    // Force a small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
      const sortKey: SortKey = {
        id: 'manual',
        label: 'Manual Selection',
        selector: selector || undefined,
        parseAs,
        direction
      };

      const message = {
        type: 'PREVIEW_SORT',
        urlRegex: urlRegex || undefined,
        sortKeys: [sortKey],
        missingValuePolicy: settings?.missingValuePolicy || 'last'
      };


      const result = await chrome.runtime.sendMessage(message);


      if (result) {
        setPreviewResult(result);
        await savePreviewResult(result);
      } else {
        setError('No result received from background script');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview sort');
    } finally {
      setPreviewLoading(false);
    }

  }

  async function handleApply() {

    setError(null);
    setApplyLoading(true);
    // Clear any existing preview since we're applying fresh
    setPreviewResult(null);

    try {
      const sortKey: SortKey = {
        id: 'manual',
        label: 'Manual Selection',
        selector: selector || undefined,
        parseAs,
        direction
      };

      const response = await chrome.runtime.sendMessage({
        type: 'SORT_TABS',
        urlRegex: urlRegex || undefined,
        sortKeys: [sortKey],
        keepPinnedStatic: settings?.keepPinnedStatic !== false,
        missingValuePolicy: settings?.missingValuePolicy || 'last'
      });


      if (response) {
        // Clear preview after successful apply (tabs are now sorted)
        await chrome.storage.local.remove(PREVIEW_RESULT_KEY);
        window.close();
      } else {
        setError('Failed to apply sort');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply sort');
    } finally {
      setApplyLoading(false);
    }
  }

  async function handleTestRegex() {
    setRegexTestLoading(true);
    setRegexTestResult(null);

    try {
      // Query tabs with the current regex
      const tabs = await chrome.runtime.sendMessage({
        type: 'TEST_REGEX',
        urlRegex: urlRegex || undefined
      });

      if (tabs && tabs.length > 0) {
        // Show matched tabs with their URLs
        const tabList = tabs.map((tab: any) => `• ${tab.title || 'Untitled'}\n  ${tab.url}`).join('\n\n');
        setRegexTestResult(`Matched ${tabs.length} tab${tabs.length === 1 ? '' : 's'}:\n\n${tabList}`);
      } else {
        setRegexTestResult('No tabs matched this pattern');
      }
    } catch (err) {
      setRegexTestResult('Error: ' + (err instanceof Error ? err.message : 'Failed to test regex'));
    } finally {
      setRegexTestLoading(false);
    }
  }

  async function handleTestSelector() {
    if (!selector) {
      setTestResult('Please enter a CSS selector to test');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      // Get the active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!activeTab || !activeTab.id) {
        setTestResult('No active tab found');
        setTestLoading(false);
        return;
      }

      // Ask background script to test the selector
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_SELECTOR',
        tabId: activeTab.id,
        selector,
        parseAs
      });

      if (response && response.value !== null && response.value !== undefined) {
        const value = response.value;
        const parsed = parseValue(value, parseAs);
        // Only add quotes for text type
        const displayParsed = parseAs === 'text' ? `"${parsed}"` : parsed;
        setTestResult(`Raw: "${value}"\nParsed as ${parseAs}: ${displayParsed}`);
      } else {
        setTestResult('No element found with this selector');
      }
    } catch (err) {
      setTestResult('Error: ' + (err instanceof Error ? err.message : 'Failed to test selector'));
    } finally {
      setTestLoading(false);
    }
  }

  function parseValue(value: any, type: string): string {
    if (value === null || value === undefined) return 'null';

    const stringValue = String(value).trim();

    switch (type) {
      case 'number':
        const numMatch = stringValue.match(/[\d.]+/);
        return numMatch ? numMatch[0] : 'NaN';

      case 'price':
        const cleaned = stringValue.replace(/[^0-9.,]/g, '').replace(',', '');
        const price = parseFloat(cleaned);
        return isNaN(price) ? 'NaN' : price.toFixed(2);

      case 'date':
        const date = new Date(stringValue);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();

      default:
        return stringValue.toLowerCase();
    }
  }

  async function handleLoadUnloadedTabs() {
    setLoadingTabs(true);
    setError(null);
    setUnloadedWarning(null);

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'LOAD_UNLOADED_TABS',
        urlRegex: urlRegex || undefined
      });

      if (result.success) {
        setUnloadedWarning(`${result.message}. You can now preview to sort all tabs.`);
        setUnloadedTabCount(0);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tabs');
    } finally {
      setLoadingTabs(false);
    }
  }

  async function handleClearForm() {
    setUrlRegex('');
    setSelector('');
    setParseAs('text');
    setDirection('asc');
    setPreviewResult(null);
    setError(null);
    setTestResult(null);
    setRegexTestResult(null);
    setUnloadedWarning(null);
    setUnloadedTabCount(0);
    // Clear saved state and preview
    await chrome.storage.local.remove([POPUP_STATE_KEY, PREVIEW_RESULT_KEY]);
  }

  if (!settings) {
    return <div className="popup-loading">Loading...</div>;
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>Tab Sorter</h1>
        <div className="header-buttons">
          <button
            onClick={toggleTheme}
            className="btn-theme"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>
          <button
            onClick={handleClearForm}
            className="btn-clear"
            title="Clear form"
          >
            Clear
          </button>
        </div>
      </header>

      <div className="popup-content">
        <div className="form-section">
          <label className="form-label">
            URL Filter (regex):
            <input
              type="text"
              value={urlRegex}
              onChange={(e) => setUrlRegex(e.target.value)}
              placeholder="e.g., .*\\.amazon\\..*"
              className="form-input"
            />
          </label>
          {urlRegex && (
            <>
              <button
                onClick={handleTestRegex}
                className="btn btn-test"
                disabled={regexTestLoading}
                title="Test which tabs match this regex pattern"
                style={{ marginTop: '8px' }}
              >
                {regexTestLoading ? 'Testing...' : 'Test Regex'}
              </button>
              {regexTestResult && (
                <div className="test-result" style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>{regexTestResult}</pre>
                </div>
              )}
            </>
          )}
        </div>

        <div className="form-section">
          <label className="form-label">
            CSS Selector:
            <input
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="e.g., .price, [data-rating]"
              className="form-input"
            />
          </label>
        </div>

        <div className="form-section">
          <label className="form-label">
            Parse as:
            <select
              value={parseAs}
              onChange={(e) => setParseAs(e.target.value as typeof parseAs)}
              className="form-select"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="price">Price</option>
              <option value="date">Date</option>
            </select>
          </label>
        </div>

        {selector && (
          <div className="form-section">
            <button
              onClick={handleTestSelector}
              className="btn btn-test"
              disabled={testLoading}
              title="Test the selector on the active tab"
            >
              {testLoading ? 'Testing...' : 'Test Parsing'}
            </button>
            {testResult && (
              <div className="test-result">
                <pre>{testResult}</pre>
              </div>
            )}
          </div>
        )}

        <div className="form-section">
          <label className="form-label">
            Sort direction:
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'asc' | 'desc')}
              className="form-select"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {unloadedWarning && (
          <div className="warning-message">
            {unloadedWarning}
            {unloadedTabCount > 0 && (
              <button
                onClick={handleLoadUnloadedTabs}
                className="btn btn-load-tabs"
                disabled={loadingTabs}
                style={{ marginLeft: '12px' }}
              >
                {loadingTabs ? 'Loading Tabs...' : 'Load All Tabs'}
              </button>
            )}
          </div>
        )}

        <div className="button-group">
          <button
            onClick={handlePreview}
            className="btn btn-primary"
            disabled={previewLoading || !selector}
          >
            {previewLoading ? (
              <>
                <span className="spinner"></span>
                Extracting from tabs...
              </>
            ) : (
              'Preview'
            )}
          </button>
          <button
            onClick={handleApply}
            className="btn btn-success"
            disabled={previewLoading || applyLoading || !selector}
          >
            {applyLoading ? (
              <>
                <span className="spinner"></span>
                Applying sort...
              </>
            ) : (
              'Apply Sort'
            )}
          </button>
        </div>

        {(previewLoading || applyLoading) && (
          <div className="loading-message">
            <div className="loading-spinner"></div>
            <p>{applyLoading ? 'Applying sort to tabs...' : 'Extracting values from matched tabs...'}</p>
            <p className="loading-hint">This may take a few seconds depending on the number of tabs.</p>
          </div>
        )}

        {previewResult && (
          <div className="preview-section">
            <h3>Preview ({previewResult.tabs.length} tabs)</h3>
            <ListView
              tabs={previewResult.tabs}
              errors={previewResult.errors}
              onTabClick={async (tabId) => {
                await chrome.runtime.sendMessage({
                  type: 'FOCUS_TAB',
                  tabId
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}