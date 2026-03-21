// UC-1: CSV parsing utilities

/**
 * Compute a stable fingerprint from CSV column headers.
 * Used as the lookup key for saved column mappings.
 */
export function computeFingerprint(headers: string[]): string {
  return [...headers].sort().join('|').toLowerCase();
}

/**
 * Parse a date string into YYYY-MM-DD format.
 * Attempts ISO 8601 first, then MM/DD/YYYY, then M/D/YYYY.
 * Returns null if unparseable.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO 8601: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d.getTime())) return s;
  }

  // MM/DD/YYYY or M/D/YYYY
  const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const month = m.padStart(2, '0');
    const day = d.padStart(2, '0');
    const candidate = `${y}-${month}-${day}`;
    const dt = new Date(candidate + 'T00:00:00');
    if (!isNaN(dt.getTime())) return candidate;
  }

  return null;
}

/**
 * Parse an amount string to a float.
 * Strips currency symbols ($) and commas before conversion.
 * Returns null if unparseable.
 */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/[$,]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
