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
    // Delay context menu check to allow other state to settle
    setTimeout(() => {
      checkForContextMenuData();
    }, 100);
  }, []);

  // Save state whenever form values change
  useEffect(() => {
    savePopupState();
  }, [savePopupState]);

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

      const result = await chrome.runtime.sendMessage({
        type: 'PREVIEW_SORT',
        urlRegex: urlRegex || undefined,
        sortKeys: [sortKey],
        missingValuePolicy: settings?.missingValuePolicy || 'last'
      });

      if (result) {
        setPreviewResult(result);
        await savePreviewResult(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview sort');
    }
  }

  async function handleApply() {
    if (!previewResult) return;

    setError(null);

    try {
      const sortKey: SortKey = {
        id: 'manual',
        label: 'Manual Selection',
        selector: selector || undefined,
        parseAs,
        direction
      };

      await chrome.runtime.sendMessage({
        type: 'SORT_TABS',
        urlRegex: urlRegex || undefined,
        sortKeys: [sortKey],
        keepPinnedStatic: settings?.keepPinnedStatic !== false,
        missingValuePolicy: settings?.missingValuePolicy || 'last'
      });

      // Clear preview after successful apply (tabs are now sorted)
      await chrome.storage.local.remove(PREVIEW_RESULT_KEY);

      window.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply sort');
    }
  }

  async function handleAutoDetect() {
    setError(null);
    setUnloadedWarning(null);

    try {
      // First detect on the active tab only
      const detection = await chrome.runtime.sendMessage({
        type: 'AUTO_DETECT_ACTIVE_TAB'
      });

      if (!detection.success) {
        setError(detection.error || 'No suitable field found on this page');
        setLoading(false);
        return;
      }

      // Use the detected selector (if available) or keep empty for auto-detect
      const detectedSelector = detection.diagnostics?.selector || '';
      setSelector(detectedSelector);

      // Set the parse type based on what was detected
      if (detection.parseAs) {
        setParseAs(detection.parseAs as any);
      }

      // Now preview with the detected settings
      const sortKey: SortKey = {
        id: 'auto-detect',
        label: 'Auto Detection',
        selector: detectedSelector || undefined,
        parseAs: detection.parseAs || parseAs,
        direction
      };

      const result = await chrome.runtime.sendMessage({
        type: 'PREVIEW_SORT',
        urlRegex: urlRegex || undefined,
        sortKeys: [sortKey],
        missingValuePolicy: settings?.missingValuePolicy || 'last'
      });

      setPreviewResult(result);
      await savePreviewResult(result);

      // Show what was detected
      if (detection.diagnostics?.rule) {
        setError(null); // Clear any error
        // Could show a success message here if desired
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-detection failed');
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
        <button
          onClick={handleClearForm}
          className="btn-clear"
          title="Clear form"
        >
          Clear
        </button>
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
          <button
            onClick={handleAutoDetect}
            className="btn btn-secondary"
            title="Automatically detect common fields (ratings, prices, dates)"
          >
            Auto-Detect
          </button>
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
              {testLoading ? 'Testing...' : 'Test'}
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
          >
            Preview
          </button>
          {previewResult && (
            <button
              onClick={handleApply}
              className="btn btn-success"
            >
              Apply Sort
            </button>
          )}
        </div>

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