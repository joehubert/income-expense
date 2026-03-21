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

/** Returns true if two rules can conflict (same specificity, overlapping conditions, different actions). */
export function rulesConflict(a: Rule, b: Rule): boolean {
  if (a.id === b.id) return false;
  if (getSpecificity(a) !== getSpecificity(b)) return false;

  // Account: both non-null and different → cannot match same transaction
  if (a.account !== null && b.account !== null && a.account !== b.account) return false;

  // Payee: both exact and different strings → cannot match same transaction
  if (
    a.payeePattern !== null &&
    b.payeePattern !== null &&
    a.payeeMatchType === 'exact' &&
    b.payeeMatchType === 'exact' &&
    a.payeePattern !== b.payeePattern
  ) return false;

  // Amount: both have ranges and they don't overlap
  const aHasAmount = a.amountMin !== null || a.amountMax !== null;
  const bHasAmount = b.amountMin !== null || b.amountMax !== null;
  if (aHasAmount && bHasAmount && !amountRangesOverlap(a, b)) return false;

  return rulesProduceDifferentActions(a, b);
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
