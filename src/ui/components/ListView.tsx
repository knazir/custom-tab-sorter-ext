import React from 'react';
import { TabInfo } from '../../types';
import './listview.css';

interface ListViewProps {
  tabs: Array<TabInfo & { extractedValue?: any }>;
  errors: Array<{
    tabId: number;
    error: string;
    tabTitle?: string;
    tabUrl?: string;
  }>;
  onTabClick?: (tabId: number) => void;
}

export function ListView({ tabs, errors, onTabClick }: ListViewProps) {
  return (
    <div className="list-view">
      <div className="tab-list">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.pinned ? 'pinned' : ''}`}
            onClick={() => onTabClick?.(tab.id)}
          >
            <div className="tab-index">{index + 1}</div>
            <div className="tab-icon">
              {tab.favIconUrl ? (
                <img src={tab.favIconUrl} alt="" />
              ) : (
                <div className="tab-icon-placeholder" />
              )}
            </div>
            <div className="tab-info">
              <div className="tab-title">{tab.title}</div>
              <div className="tab-url">{new URL(tab.url).hostname}</div>
            </div>
            <div className="tab-value">
              {tab.extractedValue !== null && tab.extractedValue !== undefined
                ? String(tab.extractedValue).substring(0, 50)
                : '—'}
            </div>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="error-list">
          <h4>Extraction Errors ({errors.length})</h4>
          {errors.map(error => {
            const displayName = error.tabTitle
              ? error.tabTitle.substring(0, 50) + (error.tabTitle.length > 50 ? '...' : '')
              : error.tabUrl
              ? new URL(error.tabUrl).hostname
              : `Tab ${error.tabId}`;

            return (
              <div
                key={`${error.tabId}-${error.tabUrl}`}
                className="error-item"
                onClick={() => onTabClick?.(error.tabId)}
                style={{ cursor: onTabClick ? 'pointer' : 'default' }}
              >
                <div className="error-text">
                  <strong>{displayName}:</strong> {error.error}
                  {error.error.includes('not loaded') && (
                    <span style={{ fontSize: '10px', display: 'block', marginTop: '2px', opacity: 0.7 }}>
                      Tab is suspended - click to view
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}