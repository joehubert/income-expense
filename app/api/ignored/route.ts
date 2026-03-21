// UC-6: Ignored transactions list with reason annotation
import { NextResponse } from 'next/server';
import { readTransactions, readRules } from '@/lib/data';
import { matchesRule } from '@/lib/rules';
import type { Transaction, Rule } from '@/types';

export interface IgnoredTransaction extends Transaction {
  reason: string; // rule description, or "Manual"
}

function findIgnoreRule(t: Transaction, rules: Rule[]): Rule | null {
  // Find the most specific rule with isIgnored=true that matches this transaction
  return rules.find((r) => r.isIgnored === true && matchesRule(r, t)) ?? null;
}

export async function GET() {
  const transactions = readTransactions().filter((t) => t.isIgnored && !t.isDiscarded);
  const rules = readRules();

  // Sort by date descending
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  const enriched: IgnoredTransaction[] = transactions.map((t) => {
    const rule = findIgnoreRule(t, rules);
    return {
      ...t,
      reason: rule ? (rule.description ?? `Rule: ${rule.id.slice(0, 8)}`) : 'Manual',
    };
  });

  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({ transactions: enriched, totalAmount });
}
