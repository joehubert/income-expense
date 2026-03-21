// UC-5: Duplicate groups list
import { NextResponse } from 'next/server';
import { readTransactions } from '@/lib/data';
import type { Transaction } from '@/types';

export interface DuplicateGroup {
  key: string;           // date|rawPayee|amount
  date: string;
  rawPayee: string;
  amount: number;
  transactions: Transaction[];
}

export async function GET() {
  const all = readTransactions();

  // Collect transactions that are flagged as duplicate and not discarded
  const flagged = all.filter((t) => t.isDuplicate && !t.isDiscarded);

  // Group by composite key
  const groups = new Map<string, Transaction[]>();
  for (const t of flagged) {
    const key = `${t.date}|${t.rawPayee}|${t.amount}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const result: DuplicateGroup[] = [];
  for (const [key, transactions] of groups) {
    // Only surface groups with 2+ non-discarded transactions
    if (transactions.length < 2) continue;
    const [first] = transactions;
    result.push({
      key,
      date: first.date,
      rawPayee: first.rawPayee,
      amount: first.amount,
      transactions,
    });
  }

  // Sort groups by date desc
  result.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ groups: result });
}
