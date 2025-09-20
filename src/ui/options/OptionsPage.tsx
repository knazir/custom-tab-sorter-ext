import React, { useState, useEffect } from 'react';
import { Settings, SiteProfile, SortKey } from '../../types';
import './options.css';

export function OptionsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [newProfile, setNewProfile] = useState<Partial<SiteProfile>>({});
  const [newSortKey, setNewSortKey] = useState<Partial<SortKey>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    setSettings(response);
  }

  async function saveSettings(updatedSettings: Settings) {
    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: updatedSettings
    });
    setSettings(updatedSettings);
    setSaveStatus('Settings saved!');
    setTimeout(() => setSaveStatus(''), 2000);
  }

  function addSiteProfile() {
    if (!settings || !newProfile.id || !newProfile.label || !newProfile.domainPattern || !newProfile.selector) {
      return;
    }

    const profile: SiteProfile = {
      id: newProfile.id,
      label: newProfile.label,
      domainPattern: newProfile.domainPattern,
      selector: newProfile.selector,
      attribute: newProfile.attribute,
      parseAs: newProfile.parseAs
    };

    const updatedSettings = {
      ...settings,
      siteProfiles: [...settings.siteProfiles, profile]
    };

    saveSettings(updatedSettings);
    setNewProfile({});
  }

  function removeSiteProfile(id: string) {
    if (!settings) return;

    const updatedSettings = {
      ...settings,
      siteProfiles: settings.siteProfiles.filter(p => p.id !== id)
    };

    saveSettings(updatedSettings);
  }

  function addSortKey() {
    if (!settings || !newSortKey.id || !newSortKey.label) {
      return;
    }

    const sortKey: SortKey = {
      id: newSortKey.id,
      label: newSortKey.label,
      selector: newSortKey.selector,
      attribute: newSortKey.attribute,
      parseAs: newSortKey.parseAs,
      direction: newSortKey.direction || 'asc',
      comparatorJS: newSortKey.comparatorJS
    };

    const updatedSettings = {
      ...settings,
      savedSortKeys: [...settings.savedSortKeys, sortKey]
    };

    saveSettings(updatedSettings);
    setNewSortKey({});
  }

  function removeSortKey(id: string) {
    if (!settings) return;

    const updatedSettings = {
      ...settings,
      savedSortKeys: settings.savedSortKeys.filter(k => k.id !== id)
    };

    saveSettings(updatedSettings);
  }

  async function exportSettings() {
    if (!settings) return;

    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `tab-sorter-settings-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  async function importSettings(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const importedSettings = JSON.parse(text);
      await saveSettings(importedSettings);
    } catch (error) {
      setSaveStatus('Failed to import settings');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }

  if (!settings) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>Tab Sorter Settings</h1>
        {saveStatus && <div className="save-status">{saveStatus}</div>}
      </header>

      <div className="options-content">
        <section className="options-section">
          <h2>General Settings</h2>

          <div className="setting-row">
            <label>
              Default Scope:
              <select
                value={settings.scope}
                onChange={(e) => saveSettings({ ...settings, scope: e.target.value as 'currentWindow' | 'allWindows' })}
              >
                <option value="currentWindow">Current Window</option>
                <option value="allWindows">All Windows</option>
              </select>
            </label>
          </div>

          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={settings.keepPinnedStatic}
                onChange={(e) => saveSettings({ ...settings, keepPinnedStatic: e.target.checked })}
              />
              Keep pinned tabs in place
            </label>
          </div>

          <div className="setting-row">
            <label>
              Missing values:
              <select
                value={settings.missingValuePolicy}
                onChange={(e) => saveSettings({ ...settings, missingValuePolicy: e.target.value as 'last' | 'first' | 'error' })}
              >
                <option value="last">Place at end</option>
                <option value="first">Place at beginning</option>
                <option value="error">Show error</option>
              </select>
            </label>
          </div>
        </section>

        <section className="options-section">
          <h2>Site Profiles</h2>

          <div className="profile-list">
            {settings.siteProfiles.map(profile => (
              <div key={profile.id} className="profile-item">
                <div className="profile-info">
                  <strong>{profile.label}</strong>
                  <span className="profile-domain">{profile.domainPattern}</span>
                  <code className="profile-selector">{profile.selector}</code>
                </div>
                <button
                  onClick={() => removeSiteProfile(profile.id)}
                  className="btn-remove"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="add-profile">
            <h3>Add Site Profile</h3>
            <div className="form-grid">
              <input
                type="text"
                placeholder="ID (e.g., imdb-rating)"
                value={newProfile.id || ''}
                onChange={(e) => setNewProfile({ ...newProfile, id: e.target.value })}
              />
              <input
                type="text"
                placeholder="Label (e.g., IMDb Rating)"
                value={newProfile.label || ''}
                onChange={(e) => setNewProfile({ ...newProfile, label: e.target.value })}
              />
              <input
                type="text"
                placeholder="Domain Pattern (e.g., *.imdb.com)"
                value={newProfile.domainPattern || ''}
                onChange={(e) => setNewProfile({ ...newProfile, domainPattern: e.target.value })}
              />
              <input
                type="text"
                placeholder="CSS Selector"
                value={newProfile.selector || ''}
                onChange={(e) => setNewProfile({ ...newProfile, selector: e.target.value })}
              />
              <input
                type="text"
                placeholder="Attribute (optional)"
                value={newProfile.attribute || ''}
                onChange={(e) => setNewProfile({ ...newProfile, attribute: e.target.value })}
              />
              <select
                value={newProfile.parseAs || ''}
                onChange={(e) => setNewProfile({ ...newProfile, parseAs: e.target.value as any })}
              >
                <option value="">Parse as...</option>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="price">Price</option>
                <option value="date">Date</option>
              </select>
            </div>
            <button onClick={addSiteProfile} className="btn-add">Add Profile</button>
          </div>
        </section>

        <section className="options-section">
          <h2>Saved Sort Keys</h2>

          <div className="sortkey-list">
            {settings.savedSortKeys.map(key => (
              <div key={key.id} className="sortkey-item">
                <div className="sortkey-info">
                  <strong>{key.label}</strong>
                  {key.selector && <code>{key.selector}</code>}
                  <span className="sortkey-meta">
                    {key.parseAs} / {key.direction}
                  </span>
                </div>
                <button
                  onClick={() => removeSortKey(key.id)}
                  className="btn-remove"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="add-sortkey">
            <h3>Add Sort Key</h3>
            <div className="form-grid">
              <input
                type="text"
                placeholder="ID"
                value={newSortKey.id || ''}
                onChange={(e) => setNewSortKey({ ...newSortKey, id: e.target.value })}
              />
              <input
                type="text"
                placeholder="Label"
                value={newSortKey.label || ''}
                onChange={(e) => setNewSortKey({ ...newSortKey, label: e.target.value })}
              />
              <input
                type="text"
                placeholder="CSS Selector"
                value={newSortKey.selector || ''}
                onChange={(e) => setNewSortKey({ ...newSortKey, selector: e.target.value })}
              />
              <select
                value={newSortKey.parseAs || ''}
                onChange={(e) => setNewSortKey({ ...newSortKey, parseAs: e.target.value as any })}
              >
                <option value="">Parse as...</option>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="price">Price</option>
                <option value="date">Date</option>
              </select>
              <select
                value={newSortKey.direction || 'asc'}
                onChange={(e) => setNewSortKey({ ...newSortKey, direction: e.target.value as 'asc' | 'desc' })}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
            <button onClick={addSortKey} className="btn-add">Add Sort Key</button>
          </div>
        </section>

        <section className="options-section">
          <h2>Import/Export</h2>
          <div className="import-export">
            <button onClick={exportSettings} className="btn-export">Export Settings</button>
            <label className="btn-import">
              Import Settings
              <input type="file" accept=".json" onChange={importSettings} style={{ display: 'none' }} />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}