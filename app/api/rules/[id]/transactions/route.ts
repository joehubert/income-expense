// UC-3C: Transactions matched by a specific rule
import { NextRequest, NextResponse } from 'next/server';
import { readRules, readTransactions } from '@/lib/data';
import { matchesRule } from '@/lib/rules';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rules = readRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const transactions = readTransactions().filter(
    (t) => !t.isDiscarded && matchesRule(rule, t)
  );

  return NextResponse.json({ transactions });
}
