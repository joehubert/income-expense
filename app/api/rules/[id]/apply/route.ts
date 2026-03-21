// UC-3D: Apply a single rule (uncategorized or force)
import { NextRequest, NextResponse } from 'next/server';
import { readRules, readTransactions, writeTransactions } from '@/lib/data';
import { applySingleRule } from '@/lib/rules';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { mode } = (await req.json()) as { mode: 'uncategorized' | 'force' };

  const rules = readRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const transactions = readTransactions();
  const { transactions: updated, affected } = applySingleRule(transactions, rule, mode);
  writeTransactions(updated);

  return NextResponse.json({ affected });
}
