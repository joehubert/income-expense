// UC-4: Payee summary — grouped by rawPayee with rule match info
import { NextResponse } from 'next/server';
import { readTransactions, readRules } from '@/lib/data';
import { matchesRule, getSpecificity } from '@/lib/rules';
import type { Transaction, Rule } from '@/types';

export interface PayeeSummary {
  rawPayee: string;
  count: number;
  totalAmount: number;
  minAmount: number;
  maxAmount: number;
  matchedRule: { id: string; description: string | null } | null;
  isUnmatched: boolean;
}

function findMatchingRule(rawPayee: string, rules: Rule[]): Rule | null {
  // Build a synthetic transaction to test rules against (no account/amount constraints checked here)
  // We check only payeePattern since we're doing a payee-level summary.
  // A payee is considered "matched" if any rule has a payeePattern that matches it.
  const synthetic: Transaction = {
    id: '',
    date: '',
    amount: 0,
    isIncome: false,
    account: '',
    source: '',
    rawPayee,
    normalizedPayee: null,
    category: null,
    subCategory: null,
    isIgnored: false,
    isDuplicate: false,
    isManuallyOverridden: false,
    isDiscarded: false,
    importedAt: '',
    notes: null,
  };
  // Return the most specific matching rule that has a payeePattern
  const sorted = [...rules].sort((a, b) => getSpecificity(a) - getSpecificity(b));
  return sorted.find((r) => r.payeePattern !== null && matchesRule(r, synthetic)) ?? null;
}

export async function GET() {
  const transactions = readTransactions().filter((t) => !t.isDiscarded && !t.isIgnored);
  const rules = readRules();

  // Group by rawPayee
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const existing = groups.get(t.rawPayee) ?? [];
    existing.push(t);
    groups.set(t.rawPayee, existing);
  }

  const payees: PayeeSummary[] = [];
  for (const [rawPayee, txns] of groups) {
    const amounts = txns.map((t) => t.amount);
    const matchedRule = findMatchingRule(rawPayee, rules);
    payees.push({
      rawPayee,
      count: txns.length,
      totalAmount: amounts.reduce((s, a) => s + a, 0),
      minAmount: Math.min(...amounts),
      maxAmount: Math.max(...amounts),
      matchedRule: matchedRule
        ? { id: matchedRule.id, description: matchedRule.description }
        : null,
      isUnmatched: matchedRule === null,
    });
  }

  return NextResponse.json({ payees });
}
