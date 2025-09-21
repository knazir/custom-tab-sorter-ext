/**
 * Shared parsing utilities for extracting and normalizing values from DOM elements
 */

export type ParseType = "number" | "price" | "date" | "text";

/**
 * Parse a numeric value from text
 */
export function parseNumberValue(text: string): number | null {
  const match = text.match(/[\d.]+/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
}

/**
 * Parse a price value from text, handling currency symbols and formatting
 */
export function parsePriceValue(text: string): number | null {
  // Remove currency symbols and spaces, keep numbers, dots, and commas
  const cleaned = text.replace(/[^0-9.,]/g, '');
  // Normalize decimal separator (assume comma is thousands separator)
  const normalized = cleaned.replace(',', '');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Parse a date value from text
 */
export function parseDateValue(text: string): Date | null {
  const date = new Date(text);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse text value (normalized for comparison)
 */
export function parseTextValue(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Parse any value based on the specified type
 */
export function parseValue(
  value: any,
  parseAs?: ParseType
): any {
  if (value === null || value === undefined) return null;

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  switch (parseAs) {
    case 'number':
      return parseNumberValue(stringValue);

    case 'price':
      return parsePriceValue(stringValue);

    case 'date':
      return parseDateValue(stringValue);

    case 'text':
    default:
      return parseTextValue(stringValue);
  }
}

/**
 * Format a parsed value for display
 */
export function formatParsedValue(value: any, type: ParseType): string {
  if (value === null || value === undefined) return 'null';

  switch (type) {
    case 'number':
      return String(value);

    case 'price':
      return typeof value === 'number' ? value.toFixed(2) : 'NaN';

    case 'date':
      return value instanceof Date ? value.toLocaleDateString() : 'Invalid Date';

    case 'text':
    default:
      return String(value);
  }
}

/**
 * Detect the likely parse type based on the value
 */
export function detectParseType(value: string): ParseType {
  const trimmed = value.trim();

  // Check if it looks like a pure number
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return 'number';
  }

  // Check if it looks like a price (currency symbols or decimal places for money)
  if (/[\$£€¥₹]/.test(trimmed) || /\d+[.,]\d{2}$/.test(trimmed)) {
    return 'price';
  }

  // Check if it looks like a date
  if (/\d{4}-\d{2}-\d{2}/.test(trimmed) ||
      /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed) ||
      /\d{1,2}-\d{1,2}-\d{2,4}/.test(trimmed)) {
    return 'date';
  }

  // Default to text
  return 'text';
}