import React from 'react';
import { TabInfo } from '../../types';
import './listview.css';

interface ListViewProps {
  tabs: Array<TabInfo & { extractedValue?: any }>;
  errors: Array<{ tabId: number; error: string }>;
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
          {errors.map(error => (
            <div key={error.tabId} className="error-item">
              Tab {error.tabId}: {error.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}