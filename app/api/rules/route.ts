// UC-3: Rules list + create
import { NextRequest, NextResponse } from 'next/server';
import { readRules, writeRules, readTransactions, writeTransactions } from '@/lib/data';
import { buildConflictMap, matchesRule, applySingleRule } from '@/lib/rules';
import type { Rule } from '@/types';

// GET /api/rules — returns rules with matchCount and conflictsWith
export async function GET() {
  const rules = readRules();
  const transactions = readTransactions();
  const conflictMap = buildConflictMap(rules);

  const enriched = rules.map((r) => ({
    ...r,
    matchCount: transactions.filter((t) => !t.isDiscarded && matchesRule(r, t)).length,
    conflictsWith: Array.from(conflictMap.get(r.id) ?? []),
  }));

  return NextResponse.json({ rules: enriched });
}

// POST /api/rules — create rule, then auto-apply to uncategorized transactions
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>;

  const now = new Date().toISOString();
  const rule: Rule = {
    ...body,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  const rules = readRules();
  rules.push(rule);
  writeRules(rules);

  // Auto-apply to uncategorized, non-overridden transactions (UC-3B)
  const transactions = readTransactions();
  const { transactions: updated } = applySingleRule(transactions, rule, 'import');
  writeTransactions(updated);

  // Compute conflict info for the new rule
  const conflictMap = buildConflictMap(rules);
  const enriched = {
    ...rule,
    matchCount: updated.filter((t) => !t.isDiscarded && matchesRule(rule, t)).length,
    conflictsWith: Array.from(conflictMap.get(rule.id) ?? []),
  };

  return NextResponse.json({ rule: enriched }, { status: 201 });
}
