import { NextRequest, NextResponse } from 'next/server';
import { readTransactions } from '@/lib/data';

export interface AccountSummaryRow {
  account: string;
  income: number;
  expense: number;
  net: number;
}

export interface AccountSummaryResponse {
  accounts: AccountSummaryRow[];
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from') ?? '';
  const to   = searchParams.get('to') ?? '';

  const transactions = readTransactions().filter((t) => {
    if (t.isIgnored || t.isDiscarded) return false;
    if (from && t.date < from) return false;
    if (to   && t.date > to)   return false;
    return true;
  });

  const accountMap = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    const acct = t.account ?? 'Unknown';
    const existing = accountMap.get(acct) ?? { income: 0, expense: 0 };
    if (t.isIncome) {
      accountMap.set(acct, { ...existing, income: existing.income + Math.abs(t.amount) });
    } else {
      accountMap.set(acct, { ...existing, expense: existing.expense + Math.abs(t.amount) });
    }
  }

  const accounts: AccountSummaryRow[] = [...accountMap.entries()]
    .map(([account, { income, expense }]) => ({
      account,
      income,
      expense,
      net: income - expense,
    }))
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

  const totalIncome  = accounts.reduce((s, a) => s + a.income, 0);
  const totalExpense = accounts.reduce((s, a) => s + a.expense, 0);

  return NextResponse.json({
    accounts,
    totalIncome,
    totalExpense,
    totalNet: totalIncome - totalExpense,
  } satisfies AccountSummaryResponse);
}
