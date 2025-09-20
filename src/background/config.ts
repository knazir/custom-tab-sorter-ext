import { Settings, SiteProfile } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  scope: 'currentWindow',
  keepPinnedStatic: true,
  missingValuePolicy: 'last',
  siteProfiles: [],
  savedSortKeys: []
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ settings: updated });
}

export async function getSiteProfiles(): Promise<SiteProfile[]> {
  const settings = await getSettings();
  return settings.siteProfiles;
}

export async function addSiteProfile(profile: SiteProfile): Promise<void> {
  const settings = await getSettings();
  settings.siteProfiles.push(profile);
  await saveSettings(settings);
}