import { NextRequest, NextResponse } from 'next/server';
import { readTransactions } from '@/lib/data';

export interface AccountTrendRow {
  account: string;
  color: string;
  incomeByMonth: number[];
  expenseByMonth: number[];
  netByMonth: number[];
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
}

export interface AccountTrendResponse {
  months: string[];       // "YYYY-MM"
  monthLabels: string[];  // "Jan 2026"
  accounts: AccountTrendRow[];
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const COLORS = [
  '#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#84cc16','#6366f1',
];

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

  // Build ordered gap-filled months array
  const monthSet = new Set<string>();
  for (const t of transactions) monthSet.add(t.date.slice(0, 7));

  const months: string[] = [];
  const monthLabels: string[] = [];

  if (monthSet.size > 0) {
    const allMonths = [...monthSet].sort();
    const startMonth = from ? from.slice(0, 7) : allMonths[0];
    const endMonth   = to   ? to.slice(0, 7)   : allMonths[allMonths.length - 1];

    let cursor = startMonth;
    while (cursor <= endMonth) {
      const [y, m] = cursor.split('-').map(Number);
      months.push(cursor);
      monthLabels.push(`${MONTH_LABELS[m - 1]} ${y}`);
      cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
  }

  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const n = months.length;

  // Group: account → month → { income, expense }
  const accountMap = new Map<string, { income: number[]; expense: number[] }>();

  for (const t of transactions) {
    const acct = t.account ?? 'Unknown';
    const mi = monthIndex.get(t.date.slice(0, 7));
    if (mi === undefined) continue;

    if (!accountMap.has(acct)) {
      accountMap.set(acct, {
        income:  new Array(n).fill(0),
        expense: new Array(n).fill(0),
      });
    }
    const entry = accountMap.get(acct)!;
    if (t.isIncome) {
      entry.income[mi]  += Math.abs(t.amount);
    } else {
      entry.expense[mi] += Math.abs(t.amount);
    }
  }

  // Build sorted accounts (by total volume descending)
  const accounts: AccountTrendRow[] = [...accountMap.entries()]
    .map(([account, { income, expense }]) => {
      const netByMonth   = income.map((inc, i) => inc - expense[i]);
      const totalIncome  = income.reduce((s, v) => s + v, 0);
      const totalExpense = expense.reduce((s, v) => s + v, 0);
      return {
        account,
        color: '',
        incomeByMonth: income,
        expenseByMonth: expense,
        netByMonth,
        totalIncome,
        totalExpense,
        totalNet: totalIncome - totalExpense,
      };
    })
    .sort((a, b) => (b.totalIncome + b.totalExpense) - (a.totalIncome + a.totalExpense));

  // Assign colors after sort for stability
  accounts.forEach((a, i) => { a.color = COLORS[i % COLORS.length]; });

  return NextResponse.json({ months, monthLabels, accounts } satisfies AccountTrendResponse);
}
