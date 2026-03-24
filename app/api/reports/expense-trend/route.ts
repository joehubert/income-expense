// UC-7C: Expense Trend — monthly expense sums by category and sub-category
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions } from '@/lib/data';

export interface SubCategoryTrend {
  subCategory: string;     // "" = no sub-category
  amountByMonth: number[]; // index matches ExpenseTrendResponse.months[]
  total: number;
  monthlyAvg: number;
}

export interface CategoryTrend {
  category: string;
  color: string;
  amountByMonth: number[]; // index matches ExpenseTrendResponse.months[]
  total: number;
  monthlyAvg: number;
  subCategories: SubCategoryTrend[];
}

export interface ExpenseTrendResponse {
  months: string[];        // "YYYY-MM"
  monthLabels: string[];   // "Jan 2026"
  categories: CategoryTrend[];
  totalByMonth: number[];
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
    if (t.isIncome) return false;
    if (from && t.date < from) return false;
    if (to   && t.date > to)   return false;
    return true;
  });

  // Build ordered months array (gap-filled)
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
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      cursor = next;
    }
  }

  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const n = months.length;

  // Group: category → subCategory → monthIndex → amount
  // Using Map<string, Map<string, number[]>>
  const catMap = new Map<string, Map<string, number[]>>();

  for (const t of transactions) {
    const cat    = t.category    ?? 'Uncategorized';
    const sub    = t.subCategory ?? '';
    const mi     = monthIndex.get(t.date.slice(0, 7));
    if (mi === undefined) continue;

    if (!catMap.has(cat)) catMap.set(cat, new Map());
    const subMap = catMap.get(cat)!;
    if (!subMap.has(sub)) subMap.set(sub, new Array(n).fill(0));
    subMap.get(sub)![mi] += Math.abs(t.amount);
  }

  // Build categories sorted by total descending
  const categories: CategoryTrend[] = [];
  let colorIdx = 0;

  for (const [cat, subMap] of catMap) {
    const amountByMonth = new Array(n).fill(0) as number[];

    const subCategories: SubCategoryTrend[] = [];
    for (const [sub, amounts] of subMap) {
      const total = amounts.reduce((s, v) => s + v, 0);
      subCategories.push({
        subCategory: sub,
        amountByMonth: amounts,
        total,
        monthlyAvg: n > 0 ? total / n : 0,
      });
      for (let i = 0; i < n; i++) amountByMonth[i] += amounts[i];
    }

    // Sort sub-categories by total descending
    subCategories.sort((a, b) => b.total - a.total);

    const total = amountByMonth.reduce((s, v) => s + v, 0);
    categories.push({
      category: cat,
      color: COLORS[colorIdx % COLORS.length],
      amountByMonth,
      total,
      monthlyAvg: n > 0 ? total / n : 0,
      subCategories,
    });
    colorIdx++;
  }

  categories.sort((a, b) => b.total - a.total);

  // Re-assign colors after sorting so highest-spend categories get stable colors
  categories.forEach((c, i) => { c.color = COLORS[i % COLORS.length]; });

  // Total by month across all categories
  const totalByMonth = new Array(n).fill(0) as number[];
  for (const c of categories) {
    for (let i = 0; i < n; i++) totalByMonth[i] += c.amountByMonth[i];
  }

  return NextResponse.json({
    months,
    monthLabels,
    categories,
    totalByMonth,
  } satisfies ExpenseTrendResponse);
}
