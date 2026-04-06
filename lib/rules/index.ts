// UC-3: Rule engine — matching, specificity, conflict detection, application
import type { Transaction, Rule } from '@/types';

// ---------------------------------------------------------------------------
// Specificity (Section 2.3)
// ---------------------------------------------------------------------------

/**
 * Returns a numeric specificity score for a rule.
 * Lower number = higher priority (most specific wins).
 */
export function getSpecificity(rule: Rule): number {
  const hasAccount = rule.account !== null;
  const hasPayee = rule.payeePattern !== null;
  const hasAmount = rule.amountMin !== null || rule.amountMax !== null;

  if (hasAccount && hasPayee && hasAmount) return 1;
  if (hasAccount && hasPayee) return 2;
  if (hasPayee && hasAmount) return 3;
  if (hasAccount && hasAmount) return 4;
  if (hasPayee) return 5;
  if (hasAccount) return 6;
  if (hasAmount) return 7;
  return 8; // no conditions — invalid but handled gracefully
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function matchPayee(
  pattern: string,
  matchType: Rule['payeeMatchType'],
  rawPayee: string
): boolean {
  switch (matchType) {
    case 'substring':
      return rawPayee.toLowerCase().includes(pattern.toLowerCase());
    case 'exact':
      return rawPayee === pattern;
    case 'regex': {
      try {
        return new RegExp(pattern, 'i').test(rawPayee);
      } catch {
        return false;
      }
    }
  }
}

/** Returns true if the rule matches the transaction. */
export function matchesRule(rule: Rule, t: Transaction): boolean {
  if (rule.account !== null && rule.account !== t.account) return false;

  if (rule.payeePattern !== null) {
    if (!matchPayee(rule.payeePattern, rule.payeeMatchType, t.rawPayee)) return false;
  }

  if (rule.amountMin !== null && t.amount < rule.amountMin) return false;
  if (rule.amountMax !== null && t.amount > rule.amountMax) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Conflict detection (Section 2.3)
// ---------------------------------------------------------------------------

function amountRangesOverlap(a: Rule, b: Rule): boolean {
  const aMin = a.amountMin ?? -Infinity;
  const aMax = a.amountMax ?? Infinity;
  const bMin = b.amountMin ?? -Infinity;
  const bMax = b.amountMax ?? Infinity;
  return aMax >= bMin && bMax >= aMin;
}

function rulesProduceDifferentActions(a: Rule, b: Rule): boolean {
  return (
    a.normalizedPayee !== b.normalizedPayee ||
    a.category !== b.category ||
    a.subCategory !== b.subCategory ||
    a.isIgnored !== b.isIgnored
  );
}

/**
 * If a regex is ^-anchored with a literal prefix (no special chars), returns
 * that prefix lowercased. Returns null otherwise.
 * Used to detect non-overlap between two anchored patterns.
 */
function anchoredLiteralPrefix(pattern: string): string | null {
  if (!pattern.startsWith('^')) return null;
  let rest = pattern.slice(1);
  // Strip inline case-insensitive flag — we lowercase the result anyway
  if (rest.startsWith('(?i)')) rest = rest.slice(4);
  let i = 0;
  while (i < rest.length && !/[.*+?${}[\]|()\\]/.test(rest[i])) i++;
  if (i === 0) return null;
  return rest.slice(0, i).toLowerCase();
}

/** Returns true if two rules can conflict (same specificity, overlapping conditions, different actions). */
export function rulesConflict(a: Rule, b: Rule): boolean {
  if (a.id === b.id) return false;
  if (getSpecificity(a) !== getSpecificity(b)) return false;

  // Account: both non-null and different → cannot match same transaction
  if (a.account !== null && b.account !== null && a.account !== b.account) return false;

  // Payee: rule out conflicts where the patterns provably can't match the same string
  if (a.payeePattern !== null && b.payeePattern !== null) {
    if (a.payeeMatchType === 'exact' && b.payeeMatchType === 'exact') {
      // Both exact — different strings can't match the same transaction
      if (a.payeePattern !== b.payeePattern) return false;
    } else if (a.payeeMatchType === 'exact') {
      // a is exact: the only value that could satisfy a is a.payeePattern itself.
      // If b's pattern doesn't match that string, they can never share a transaction.
      if (!matchPayee(b.payeePattern, b.payeeMatchType, a.payeePattern)) return false;
    } else if (b.payeeMatchType === 'exact') {
      // b is exact: same logic in reverse.
      if (!matchPayee(a.payeePattern, a.payeeMatchType, b.payeePattern)) return false;
    }
    // If both patterns are ^-anchored with distinct literal prefixes, they can't overlap.
    // This applies to regex (where ^ is a start anchor) and to substring patterns that
    // start with '^' (which requires a literal '^' in the payee — essentially impossible
    // in real transaction data, so treat as anchored for conflict purposes).
    if (a.payeeMatchType !== 'exact' && b.payeeMatchType !== 'exact') {
      const pA = anchoredLiteralPrefix(a.payeePattern);
      const pB = anchoredLiteralPrefix(b.payeePattern);
      if (pA !== null && pB !== null && !pA.startsWith(pB) && !pB.startsWith(pA)) return false;
    }
  }

  // Amount: both have ranges and they don't overlap
  const aHasAmount = a.amountMin !== null || a.amountMax !== null;
  const bHasAmount = b.amountMin !== null || b.amountMax !== null;
  if (aHasAmount && bHasAmount && !amountRangesOverlap(a, b)) return false;

  return rulesProduceDifferentActions(a, b);
}

export interface ConflictExplanation {
  /** Why the two rules can match the same transaction. */
  overlap: string[];
  /** Which actions produce different results. */
  actionDiffs: string[];
}

/**
 * Returns a human-readable explanation of why two rules conflict.
 * Assumes rulesConflict(a, b) === true.
 */
export function explainConflict(a: Rule, b: Rule): ConflictExplanation {
  const overlap: string[] = [];
  const actionDiffs: string[] = [];

  // Payee overlap
  if (a.payeePattern !== null && b.payeePattern !== null) {
    if (a.payeeMatchType === 'exact' && b.payeeMatchType === 'exact' && a.payeePattern === b.payeePattern) {
      overlap.push(`Both match exact payee "${a.payeePattern}"`);
    } else {
      overlap.push(`Payee patterns may overlap: "${a.payeePattern}" (${a.payeeMatchType}) and "${b.payeePattern}" (${b.payeeMatchType})`);
    }
  } else if (a.payeePattern === null && b.payeePattern === null) {
    overlap.push('Neither rule filters by payee');
  } else {
    const withPattern = a.payeePattern !== null ? a : b;
    overlap.push(`One rule matches any payee; the other matches "${withPattern.payeePattern}" (${withPattern.payeeMatchType})`);
  }

  // Account overlap
  if (a.account !== null && b.account !== null && a.account === b.account) {
    overlap.push(`Both filter to account "${a.account}"`);
  } else if (a.account === null && b.account !== null) {
    overlap.push(`One rule is account-agnostic; the other filters to "${b.account}"`);
  } else if (a.account !== null && b.account === null) {
    overlap.push(`One rule is account-agnostic; the other filters to "${a.account}"`);
  }

  // Amount overlap
  const aHasAmount = a.amountMin !== null || a.amountMax !== null;
  const bHasAmount = b.amountMin !== null || b.amountMax !== null;
  if (aHasAmount && bHasAmount) {
    const fmtMin = (v: number | null) => v === null ? '−∞' : String(v);
    const fmtMax = (v: number | null) => v === null ? '+∞' : String(v);
    overlap.push(
      `Amount ranges overlap: $${fmtMin(a.amountMin)}–$${fmtMax(a.amountMax)} and $${fmtMin(b.amountMin)}–$${fmtMax(b.amountMax)}`
    );
  }

  // Action differences
  if (a.normalizedPayee !== b.normalizedPayee) {
    actionDiffs.push(`Payee name: "${a.normalizedPayee ?? '(none)'}" vs "${b.normalizedPayee ?? '(none)'}"`);
  }
  if (a.category !== b.category || a.subCategory !== b.subCategory) {
    const fmt = (r: Rule) => r.subCategory ? `${r.category} / ${r.subCategory}` : (r.category ?? '(none)');
    actionDiffs.push(`Category: "${fmt(a)}" vs "${fmt(b)}"`);
  }
  if (a.isIgnored !== b.isIgnored) {
    actionDiffs.push(`Ignore flag: ${a.isIgnored ? 'ignored' : 'not ignored'} vs ${b.isIgnored ? 'ignored' : 'not ignored'}`);
  }

  return { overlap, actionDiffs };
}

/** Returns a map of ruleId → Set of conflicting ruleIds. */
export function buildConflictMap(rules: Rule[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of rules) map.set(r.id, new Set());
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      if (rulesConflict(rules[i], rules[j])) {
        map.get(rules[i].id)?.add(rules[j].id);
        map.get(rules[j].id)?.add(rules[i].id);
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Application (UC-3D)
// ---------------------------------------------------------------------------

type ApplyMode = 'import' | 'uncategorized' | 'force';

function applyRuleActions(rule: Rule, t: Transaction): Transaction {
  const updated: Transaction = { ...t };
  if (rule.normalizedPayee !== null) updated.normalizedPayee = rule.normalizedPayee;
  if (rule.category !== null) updated.category = rule.category;
  if (rule.subCategory !== null) updated.subCategory = rule.subCategory;
  // isIgnored=true from a rule takes precedence over any categorization
  if (rule.isIgnored !== null) updated.isIgnored = rule.isIgnored;
  return updated;
}

/**
 * Apply all rules to a list of transactions.
 *
 * Modes:
 *   'import'        — applies to all transactions where isManuallyOverridden = false
 *   'uncategorized' — applies only where category = null AND isManuallyOverridden = false
 *   'force'         — applies to all matching transactions regardless of isManuallyOverridden
 *
 * Most-specific matching rule wins (lowest specificity number).
 */
export function applyRules(
  transactions: Transaction[],
  rules: Rule[],
  mode: ApplyMode = 'import'
): Transaction[] {
  if (rules.length === 0) return transactions;

  // Sort once by specificity ascending (most specific first)
  const sorted = [...rules].sort((a, b) => getSpecificity(a) - getSpecificity(b));

  return transactions.map((t) => {
    // Eligibility check
    if (mode === 'uncategorized') {
      if (t.category !== null || t.isManuallyOverridden) return t;
    } else if (mode === 'import') {
      if (t.isManuallyOverridden) return t;
    }
    // 'force' skips no transactions

    // Find best (most specific) matching rule
    for (const rule of sorted) {
      if (matchesRule(rule, t)) {
        return applyRuleActions(rule, t);
      }
    }
    return t;
  });
}

/**
 * Apply a single rule to transactions.
 * Returns updated transactions and count of actually-changed records.
 */
export function applySingleRule(
  transactions: Transaction[],
  rule: Rule,
  mode: ApplyMode
): { transactions: Transaction[]; affected: number } {
  let affected = 0;
  const updated = transactions.map((t) => {
    if (mode === 'uncategorized' && (t.category !== null || t.isManuallyOverridden)) return t;
    if (mode === 'import' && t.isManuallyOverridden) return t;

    if (!matchesRule(rule, t)) return t;

    const next = applyRuleActions(rule, t);
    if (JSON.stringify(next) !== JSON.stringify(t)) affected++;
    return next;
  });
  return { transactions: updated, affected };
}
