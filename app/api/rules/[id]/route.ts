// UC-3: Update + delete a rule
import { NextRequest, NextResponse } from 'next/server';
import { readRules, writeRules, readTransactions, writeTransactions } from '@/lib/data';
import { applySingleRule } from '@/lib/rules';
import type { Rule } from '@/types';

// PUT /api/rules/[id] — update rule, re-apply to uncategorized
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Rule>;

  const rules = readRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated: Rule = { ...rules[idx], ...body, id, updatedAt: new Date().toISOString() };
  rules[idx] = updated;
  writeRules(rules);

  // Re-apply updated rule to uncategorized transactions
  const transactions = readTransactions();
  const { transactions: updatedTxns } = applySingleRule(transactions, updated, 'import');
  writeTransactions(updatedTxns);

  return NextResponse.json({ rule: updated });
}

// DELETE /api/rules/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rules = readRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  rules.splice(idx, 1);
  writeRules(rules);

  return NextResponse.json({ ok: true });
}
