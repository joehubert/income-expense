// UC-3D: Apply all rules (uncategorized or force)
import { NextRequest, NextResponse } from 'next/server';
import { readRules, readTransactions, writeTransactions } from '@/lib/data';
import { applyRules } from '@/lib/rules';

export async function POST(req: NextRequest) {
  const { mode } = (await req.json()) as { mode: 'uncategorized' | 'force' };

  const rules = readRules();
  const transactions = readTransactions();
  const updated = applyRules(transactions, rules, mode);

  const affected = transactions.reduce((n, t, i) => {
    return JSON.stringify(t) === JSON.stringify(updated[i]) ? n : n + 1;
  }, 0);

  writeTransactions(updated);
  return NextResponse.json({ affected });
}
