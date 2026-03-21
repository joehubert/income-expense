// UC-7B: Income vs. Expense monthly trend
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions } from '@/lib/data';

export interface MonthData {
  month: string;    // "YYYY-MM"
  label: string;    // "Jan 2024"
  income: number;
  expense: number;
  net: number;
}

export interface IncomeExpenseResponse {
  months: MonthData[];
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  // Group by YYYY-MM
  const monthMap = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    const month = t.date.slice(0, 7); // "YYYY-MM"
    const existing = monthMap.get(month) ?? { income: 0, expense: 0 };
    if (t.isIncome) {
      monthMap.set(month, { ...existing, income: existing.income + Math.abs(t.amount) });
    } else {
      monthMap.set(month, { ...existing, expense: existing.expense + Math.abs(t.amount) });
    }
  }

  // Fill in every month in the date range so there are no gaps in the chart
  const months: MonthData[] = [];

  if (monthMap.size > 0) {
    const allMonths = [...monthMap.keys()].sort();
    const startMonth = from ? from.slice(0, 7) : allMonths[0];
    const endMonth   = to   ? to.slice(0, 7)   : allMonths[allMonths.length - 1];

    let cursor = startMonth;
    while (cursor <= endMonth) {
      const [y, m] = cursor.split('-').map(Number);
      const data = monthMap.get(cursor) ?? { income: 0, expense: 0 };
      months.push({
        month: cursor,
        label: `${MONTH_LABELS[m - 1]} ${y}`,
        income: data.income,
        expense: data.expense,
        net: data.income - data.expense,
      });
      // Advance to next month
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      cursor = next;
    }
  }

  const totalIncome  = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);

  return NextResponse.json({
    months,
    totalIncome,
    totalExpense,
    totalNet: totalIncome - totalExpense,
  } satisfies IncomeExpenseResponse);
}
