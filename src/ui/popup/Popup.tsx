import React, { useState, useEffect } from 'react';
import { Settings, SortKey, SortResult, Scope } from '../../types';
import { ListView } from '../components/ListView';
import './popup.css';

export function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [scope, setScope] = useState<Scope>('currentWindow');
  const [urlRegex, setUrlRegex] = useState('');
  const [selector, setSelector] = useState('');
  const [parseAs, setParseAs] = useState<'text' | 'number' | 'price' | 'date'>('text');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [previewResult, setPreviewResult] = useState<SortResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    setSettings(response);
    setScope(response.scope);
  }

  async function handlePreview() {
    setLoading(true);
    setError(null);

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
        scope,
        urlRegex: urlRegex || undefined,
        sortKeys: [sortKey],
        missingValuePolicy: settings?.missingValuePolicy || 'last'
      });

      setPreviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview sort');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!previewResult) return;

    setLoading(true);
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
        scope,
        urlRegex: urlRegex || undefined,
        sortKeys: [sortKey],
        keepPinnedStatic: settings?.keepPinnedStatic !== false,
        missingValuePolicy: settings?.missingValuePolicy || 'last'
      });

      window.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply sort');
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoDetect() {
    setSelector('');
    await handlePreview();
  }

  if (!settings) {
    return <div className="popup-loading">Loading...</div>;
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>Tab Sorter</h1>
      </header>

      <div className="popup-content">
        <div className="form-section">
          <label className="form-label">
            Scope:
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="form-select"
            >
              <option value="currentWindow">Current Window</option>
              <option value="allWindows">All Windows</option>
            </select>
          </label>
        </div>

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
            disabled={loading}
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

        <div className="button-group">
          <button
            onClick={handlePreview}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Preview'}
          </button>
          {previewResult && (
            <button
              onClick={handleApply}
              className="btn btn-success"
              disabled={loading}
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