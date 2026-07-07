// UC-4 / UC-3B: Derive a reusable match pattern from a raw payee string.
//
// Raw payees from bank exports carry transaction-specific junk that defeats
// pattern reuse:
//   "AMC 9640 ONLINE     LEAWOOD             KS"   (Amex fixed-width columns)
//   "Alexa Skills*bg68z2y21"                       (per-transaction suffix)
//   "WALMART #1234"                                (store number)
// The stem is the stable merchant prefix, suitable as a substring match.

export interface PayeeStem {
  /** Suggested substring match pattern. */
  pattern: string;
  /** Suggested normalized payee (title-cased, cleaned). */
  normalizedPayee: string;
}

/**
 * Processor prefixes like "SQ*", "BT*", "AWX*" are 2–3 chars before a "*".
 * Cutting there would leave a uselessly short pattern, so we keep the whole
 * "PREFIX*MERCHANT" token instead.
 */
const MIN_STEM_BEFORE_STAR = 4;

export function derivePayeeStem(rawPayee: string): PayeeStem {
  let s = rawPayee.trim();

  // Amex fixed-width layout: merchant, city, state separated by runs of
  // 2+ spaces. Keep only the first column.
  s = s.split(/\s{2,}/)[0];

  // Per-transaction "*suffix" tokens (order codes, store numbers). Only cut
  // when the part before "*" is long enough to be a meaningful pattern.
  const star = s.indexOf('*');
  if (star >= MIN_STEM_BEFORE_STAR) {
    s = s.slice(0, star);
  }

  // Trailing store numbers: "#1234", bare digit runs, or digit runs with
  // separators. Don't strip digits that are part of a word (e.g. "7-Eleven").
  s = s.replace(/\s+#?\d[\d-]*$/, '');

  // Trailing separators/punctuation left behind by the cuts above.
  s = s.replace(/[\s\-*.,]+$/, '').trim();

  // If cleaning nuked everything, fall back to the trimmed original.
  if (s.length < 2) s = rawPayee.trim();

  return { pattern: s, normalizedPayee: titleCase(s) };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s\-/&(])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
