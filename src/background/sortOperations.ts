/**
 * Sorting operations extracted from the main background script
 */

import { SortKey, SortResult, ExtractedValue } from '../types';
import { getTargetTabs, moveTabs } from './tabs';
import { extractValueFromTab } from './messaging';
import { createComparator, stableSort, TabWithValue } from './sorting';
import { TIMEOUTS, LIMITS } from '../config/constants';
import { logError, ErrorFactory, createErrorResponse } from '../utils/errors';

/**
 * Perform actual tab sorting
 */
export async function performSort(
  urlRegex: string | undefined,
  sortKeys: SortKey[],
  keepPinnedStatic: boolean,
  missingValuePolicy: 'last' | 'first' | 'error'
): Promise<SortResult> {
  const tabs = await getTargetTabs(urlRegex);

  if (tabs.length === 0) {
    return { tabs: [], errors: [] };
  }

  const extractedValues = await extractValuesFromTabs(tabs, sortKeys[0]);

  const tabsWithValues: TabWithValue[] = tabs.map(tab => {
    const extracted = extractedValues.find(e => e.tabId === tab.id);
    return {
      ...tab,
      extractedValue: extracted?.value,
      rawText: extracted?.rawText
    };
  });

  const comparator = createComparator(sortKeys, missingValuePolicy);
  const sortedTabs = stableSort(tabsWithValues, comparator);

  await moveTabs(sortedTabs, keepPinnedStatic);

  const errors = extractedValues
    .filter(e => e.value === null)
    .map(e => {
      const tab = tabs.find(t => t.id === e.tabId);
      return {
        tabId: e.tabId,
        error: e.diagnostics?.notes || 'Failed to extract value',
        tabTitle: tab?.title,
        tabUrl: tab?.url
      };
    });

  return { tabs: sortedTabs, errors };
}

/**
 * Preview sorting without actually moving tabs
 */
export async function performPreview(
  urlRegex: string | undefined,
  sortKeys: SortKey[],
  missingValuePolicy: 'last' | 'first' | 'error'
): Promise<SortResult> {
  try {
    const tabs = await getTargetTabs(urlRegex);

    if (tabs.length === 0) {
      return { tabs: [], errors: [] };
    }

    const extractedValues = await extractValuesFromTabs(tabs, sortKeys[0]);

    const tabsWithValues: TabWithValue[] = tabs.map(tab => {
      const extracted = extractedValues.find(e => e.tabId === tab.id);
      return {
        ...tab,
        extractedValue: extracted?.value,
        rawText: extracted?.rawText
      };
    });

    const comparator = createComparator(sortKeys, missingValuePolicy);
    const sortedTabs = stableSort(tabsWithValues, comparator);

    const errors = extractedValues
      .filter(e => e.value === null)
      .map(e => {
        const tab = tabs.find(t => t.id === e.tabId);
        return {
          tabId: e.tabId,
          error: e.diagnostics?.notes || 'Failed to extract value',
          tabTitle: tab?.title,
          tabUrl: tab?.url
        };
      });

    return { tabs: sortedTabs, errors };
  } catch (error) {
    logError('Preview sort', error);
    return {
      tabs: [],
      errors: [{
        tabId: -1,
        error: String(error),
        tabTitle: 'Error',
        tabUrl: ''
      }]
    };
  }
}

/**
 * Extract values from multiple tabs with improved error handling and timeouts
 */
async function extractValuesFromTabs(
  tabs: { id: number }[],
  sortKey: SortKey
): Promise<ExtractedValue[]> {

  // Create promises for each tab with individual timeout
  const promises = tabs.map(async (tab) => {
    if (!sortKey.selector) {
      return {
        tabId: tab.id,
        value: null,
        diagnostics: { notes: 'No selector provided' }
      };
    }

    // Add timeout to individual extraction
    const timeoutPromise = new Promise<ExtractedValue>((_, reject) =>
      setTimeout(() => reject(ErrorFactory.extractionTimeout(tab.id)), TIMEOUTS.TAB_EXTRACTION)
    );

    const extractionPromise = extractValueFromTab(
      tab.id,
      sortKey.selector,
      sortKey.attribute,
      sortKey.parseAs
    );

    try {
      const result = await Promise.race([extractionPromise, timeoutPromise]);
      return result;
    } catch (error) {
      const errorMessage = String(error);
      const isTimeout = errorMessage.includes('timeout');

      logError(`Extract from tab ${tab.id}`, error);

      return {
        tabId: tab.id,
        value: null,
        diagnostics: {
          notes: isTimeout ? 'Extraction timed out (tab may be loading)' : `Extraction failed: ${errorMessage}`
        }
      };
    }
  });

  try {
    // Add global timeout for all promises
    const allPromisesWithTimeout = Promise.race([
      Promise.allSettled(promises),
      new Promise<PromiseSettledResult<ExtractedValue>[]>((_, reject) =>
        setTimeout(() => reject(new Error('Global extraction timeout')), TIMEOUTS.GLOBAL_EXTRACTION)
      )
    ]);

    const results = await allPromisesWithTimeout;

    let successCount = 0;
    let timeoutCount = 0;
    let errorCount = 0;

    const extractedValues = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (value?.value !== null && value?.value !== undefined) {
          successCount++;
        } else if (value?.diagnostics?.notes?.includes('timeout')) {
          timeoutCount++;
        } else {
          errorCount++;
        }
        return value;
      } else {
        errorCount++;
        logError(`Extract from tab ${tabs[index].id}`, result.reason);
        return {
          tabId: tabs[index].id,
          value: null,
          diagnostics: {
            notes: 'Extraction failed: ' + String(result.reason)
          }
        };
      }
    });

    // Log statistics
    if (timeoutCount > 0 || errorCount > 0) {
      console.log(`Extraction complete: ${successCount} success, ${timeoutCount} timeouts, ${errorCount} errors`);
    }

    return extractedValues;
  } catch (error) {
    // Return partial results on global timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      logError('Global extraction timeout', error);
      return tabs.map(tab => ({
        tabId: tab.id,
        value: null,
        diagnostics: { notes: 'Global timeout - tab may be slow to load' }
      }));
    }
    throw error;
  }
}