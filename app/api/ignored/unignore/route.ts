// UC-6: Un-ignore one or more transactions
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions, writeTransactions } from '@/lib/data';

export async function POST(req: NextRequest) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!ids?.length) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const idSet = new Set(ids);
  const transactions = readTransactions();

  let affected = 0;
  for (let i = 0; i < transactions.length; i++) {
    if (idSet.has(transactions[i].id)) {
      // UC-6: un-ignore sets isManuallyOverridden=true to prevent rule from re-ignoring
      transactions[i] = { ...transactions[i], isIgnored: false, isManuallyOverridden: true };
      affected++;
    }
  }

  writeTransactions(transactions);
  return NextResponse.json({ affected });
}
