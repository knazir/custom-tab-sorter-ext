import { SortKey, TabInfo, ExtractedValue } from '../types';

export type TabWithValue = TabInfo & {
  extractedValue?: any;
  rawText?: string;
};

export function parseValue(
  value: any,
  parseAs?: "number" | "price" | "date" | "text"
): any {
  if (value === null || value === undefined) return null;

  const stringValue = String(value).trim();

  switch (parseAs) {
    case 'number':
      return parseNumberValue(stringValue);

    case 'price':
      return parsePriceValue(stringValue);

    case 'date':
      return parseDateValue(stringValue);

    case 'text':
    default:
      return stringValue.toLowerCase();
  }
}

function parseNumberValue(text: string): number | null {
  const match = text.match(/[\d.]+/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
}

function parsePriceValue(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,]/g, '');
  const normalized = cleaned.replace(',', '');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function parseDateValue(text: string): Date | null {
  const date = new Date(text);
  return isNaN(date.getTime()) ? null : date;
}

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