// UC-2: Transactions list API — filtering, sorting, pagination
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions } from '@/lib/data';
import type { Transaction } from '@/types';

type SortField = 'date' | 'amount' | 'rawPayee' | 'account' | 'category';

function sortTransactions(txns: Transaction[], field: SortField, order: 'asc' | 'desc'): Transaction[] {
  return [...txns].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'date':     cmp = a.date.localeCompare(b.date); break;
      case 'amount':   cmp = a.amount - b.amount; break;
      case 'rawPayee': cmp = a.rawPayee.localeCompare(b.rawPayee); break;
      case 'account':  cmp = a.account.localeCompare(b.account); break;
      case 'category': cmp = (a.category ?? '').localeCompare(b.category ?? ''); break;
    }
    return order === 'desc' ? -cmp : cmp;
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const page     = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10));
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(sp.get('pageSize') ?? '50', 10)));
  const sortField = (sp.get('sort') ?? 'date') as SortField;
  const order     = (sp.get('order') ?? 'desc') as 'asc' | 'desc';

  const dateFrom    = sp.get('dateFrom') ?? '';
  const dateTo      = sp.get('dateTo') ?? '';
  const account     = sp.get('account') ?? '';
  const category    = sp.get('category') ?? '';
  const subCategory = sp.get('subCategory') ?? '';
  const isIncome    = sp.get('isIncome') ?? '';
  const search      = sp.get('search') ?? '';
  const payee       = sp.get('payee') ?? '';   // exact rawPayee filter
  const limitParam  = sp.get('limit') ?? '';   // simple limit shortcut (no paging)

  let all = readTransactions();

  // Quick limit shortcut (for account list extraction)
  if (limitParam) {
    const limit = Number.parseInt(limitParam, 10);
    if (!Number.isNaN(limit)) {
      return NextResponse.json({ transactions: all.slice(0, limit) });
    }
  }

  // Exclude discarded; ignored are shown only at /ignored
  all = all.filter((t) => !t.isDiscarded && !t.isIgnored);

  if (dateFrom)    all = all.filter((t) => t.date >= dateFrom);
  if (dateTo)      all = all.filter((t) => t.date <= dateTo);
  if (account)     all = all.filter((t) => t.account === account);
  if (category)    all = all.filter((t) => t.category === category);
  if (subCategory) all = all.filter((t) => t.subCategory === subCategory);
  if (isIncome === 'true')  all = all.filter((t) => t.isIncome);
  if (isIncome === 'false') all = all.filter((t) => !t.isIncome);
  if (payee)       all = all.filter((t) => t.rawPayee === payee);
  if (search) {
    const q = search.toLowerCase();
    all = all.filter((t) =>
      t.rawPayee.toLowerCase().includes(q) ||
      (t.normalizedPayee ?? '').toLowerCase().includes(q)
    );
  }

  const total = all.length;
  const sorted = sortTransactions(all, sortField, order);
  const paged  = sorted.slice((page - 1) * pageSize, page * pageSize);

  // Distinct accounts for filter dropdowns
  const accounts = [...new Set(readTransactions().filter((t) => !t.isDiscarded).map((t) => t.account))].sort((a, b) => a.localeCompare(b));
  const categories = [...new Set(readTransactions().filter((t) => !t.isDiscarded && t.category).map((t) => t.category as string))].sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ transactions: paged, total, page, pageSize, accounts, categories });
}
