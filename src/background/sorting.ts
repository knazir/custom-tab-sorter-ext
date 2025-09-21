import { SortKey, TabInfo } from '../types';
import { parseValue, ParseType } from '../utils/parsing';

export type TabWithValue = TabInfo & {
  extractedValue?: any;
  rawText?: string;
};

// Parsing functions moved to utils/parsing.ts

export function createComparator(
  sortKeys: SortKey[],
  missingValuePolicy: "last" | "first" | "error"
): (a: TabWithValue, b: TabWithValue) => number {
  return (a: TabWithValue, b: TabWithValue) => {
    for (const key of sortKeys) {
      const aVal = parseValue(a.extractedValue, key.parseAs);
      const bVal = parseValue(b.extractedValue, key.parseAs);

      if (aVal === null && bVal === null) continue;

      if (aVal === null) {
        return missingValuePolicy === 'last' ? 1 : -1;
      }
      if (bVal === null) {
        return missingValuePolicy === 'last' ? -1 : 1;
      }

      let comparison = 0;

      if (key.parseAs === 'date' && aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        const aStr = String(aVal);
        const bStr = String(bVal);
        comparison = aStr.localeCompare(bStr, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      }

      if (comparison !== 0) {
        return key.direction === 'desc' ? -comparison : comparison;
      }
    }

    return a.index - b.index;
  };
}

export function stableSort<T>(
  array: T[],
  comparator: (a: T, b: T) => number
): T[] {
  const indexed = array.map((item, index) => ({ item, index }));

  indexed.sort((a, b) => {
    const result = comparator(a.item, b.item);
    return result !== 0 ? result : a.index - b.index;
  });

  return indexed.map(({ item }) => item);
}