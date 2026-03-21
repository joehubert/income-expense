// UC-5: Re-scan all transactions for duplicates on demand
import { NextResponse } from 'next/server';
import { readTransactions, writeTransactions } from '@/lib/data';

export async function POST() {
  const transactions = readTransactions();

  // Reset all duplicate flags first
  const reset = transactions.map((t) => ({ ...t, isDuplicate: false }));

  // Rebuild hash map and re-flag
  const seen = new Map<string, number>(); // key → first index
  for (let i = 0; i < reset.length; i++) {
    const t = reset[i];
    if (t.isDiscarded) continue;
    const key = `${t.date}|${t.rawPayee}|${t.amount}`;
    const firstIdx = seen.get(key);
    if (firstIdx === undefined) {
      seen.set(key, i);
    } else {
      // Flag both the first occurrence and this one
      reset[firstIdx] = { ...reset[firstIdx], isDuplicate: true };
      reset[i] = { ...t, isDuplicate: true };
    }
  }

  const duplicatesFound = reset.filter((t) => t.isDuplicate).length;
  writeTransactions(reset);

  return NextResponse.json({ duplicatesFound });
}
