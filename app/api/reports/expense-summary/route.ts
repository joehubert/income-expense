// UC-7A: Expense Summary — category → sub-category → payee breakdown
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions } from '@/lib/data';

export interface PayeeBreakdown {
  payee: string;
  amount: number;
  count: number;
}

export interface SubCategoryBreakdown {
  subCategory: string;   // empty string means no sub-category
  amount: number;
  percentage: number;    // % of parent category total
  payees: PayeeBreakdown[];
}

export interface CategoryBreakdown {
  category: string;      // "Uncategorized" if null
  amount: number;
  percentage: number;    // % of total expense spend
  subCategories: SubCategoryBreakdown[];
}

export interface ExpenseSummaryResponse {
  categories: CategoryBreakdown[];
  totalExpense: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from') ?? '';
  const to   = searchParams.get('to') ?? '';

  const transactions = readTransactions().filter((t) => {
    if (t.isIgnored || t.isDiscarded) return false;
    if (t.isIncome) return false;                       // expenses only
    if (from && t.date < from) return false;
    if (to   && t.date > to)   return false;
    return true;
  });

  const totalExpense = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);

  // Group: category → subCategory → payee
  type PayeeMap  = Map<string, { amount: number; count: number }>;
  type SubMap    = Map<string, PayeeMap>;
  type CatMap    = Map<string, SubMap>;

  const catMap: CatMap = new Map();

  for (const t of transactions) {
    const cat = t.category ?? 'Uncategorized';
    const sub = t.subCategory ?? '';
    const pay = t.normalizedPayee ?? t.rawPayee;
    const amt = Math.abs(t.amount);

    if (!catMap.has(cat)) catMap.set(cat, new Map());
    const subMap = catMap.get(cat)!;

    if (!subMap.has(sub)) subMap.set(sub, new Map());
    const payMap = subMap.get(sub)!;

    const existing = payMap.get(pay) ?? { amount: 0, count: 0 };
    payMap.set(pay, { amount: existing.amount + amt, count: existing.count + 1 });
  }

  const categories: CategoryBreakdown[] = [];

  for (const [category, subMap] of catMap) {
    const catAmount = [...subMap.values()].reduce(
      (s, pm) => s + [...pm.values()].reduce((s2, p) => s2 + p.amount, 0),
      0
    );

    const subCategories: SubCategoryBreakdown[] = [];
    for (const [subCategory, payMap] of subMap) {
      const subAmount = [...payMap.values()].reduce((s, p) => s + p.amount, 0);
      const payees: PayeeBreakdown[] = [...payMap.entries()]
        .map(([payee, { amount, count }]) => ({ payee, amount, count }))
        .sort((a, b) => b.amount - a.amount);

      subCategories.push({
        subCategory,
        amount: subAmount,
        percentage: catAmount > 0 ? (subAmount / catAmount) * 100 : 0,
        payees,
      });
    }
    subCategories.sort((a, b) => b.amount - a.amount);

    categories.push({
      category,
      amount: catAmount,
      percentage: totalExpense > 0 ? (catAmount / totalExpense) * 100 : 0,
      subCategories,
    });
  }

  categories.sort((a, b) => b.amount - a.amount);

  return NextResponse.json({ categories, totalExpense } satisfies ExpenseSummaryResponse);
}
