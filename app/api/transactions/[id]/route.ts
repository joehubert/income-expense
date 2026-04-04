// UC-3C / UC-2: Inline transaction edit — sets isManuallyOverridden = true
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions, writeTransactions } from '@/lib/data';
import type { Transaction } from '@/types';

type PatchBody = Partial<Pick<Transaction, 'normalizedPayee' | 'category' | 'subCategory' | 'notes' | 'isIgnored'>>;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as PatchBody;

  const transactions = readTransactions();
  const idx = transactions.findIndex((t) => t.id === id);
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  transactions[idx] = {
    ...transactions[idx],
    ...body,
    isManuallyOverridden: true,
  };
  writeTransactions(transactions);

  return NextResponse.json({ transaction: transactions[idx] });
}
