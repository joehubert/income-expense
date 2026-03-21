// UC-5: Resolve a duplicate group — keep one or mark all as not duplicate
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions, writeTransactions } from '@/lib/data';

interface ResolveRequest {
  action: 'keep' | 'not-duplicate';
  keepId?: string;          // required when action = 'keep'
  transactionIds: string[]; // all IDs in the group
}

export async function POST(req: NextRequest) {
  const { action, keepId, transactionIds } = (await req.json()) as ResolveRequest;

  if (!transactionIds?.length) {
    return NextResponse.json({ error: 'transactionIds required' }, { status: 400 });
  }

  const transactions = readTransactions();
  const idSet = new Set(transactionIds);

  if (action === 'keep') {
    if (!keepId) return NextResponse.json({ error: 'keepId required for keep action' }, { status: 400 });
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!idSet.has(t.id)) continue;
      if (t.id === keepId) {
        // Keep this one — clear the duplicate flag
        transactions[i] = { ...t, isDuplicate: false };
      } else {
        // Discard the rest
        transactions[i] = { ...t, isDiscarded: true, isDuplicate: false };
      }
    }
  } else {
    // Mark all as not duplicate
    for (let i = 0; i < transactions.length; i++) {
      if (idSet.has(transactions[i].id)) {
        transactions[i] = { ...transactions[i], isDuplicate: false };
      }
    }
  }

  writeTransactions(transactions);
  return NextResponse.json({ ok: true });
}
