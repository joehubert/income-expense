'use client';

// UC-2: View & Edit Transactions
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Transaction } from '@/types';
import EditDrawer from '@/components/EditDrawer';

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  accounts: string[];
  categories: string[];
}

type SortField = 'date' | 'amount' | 'rawPayee' | 'account' | 'category';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function SortHeader({
  field, label, sortField, order,
  onSort,
}: Readonly<{
  field: SortField; label: string;
  sortField: SortField; order: 'asc' | 'desc';
  onSort: (f: SortField) => void;
}>) {
  const active = sortField === field;
  return (
    <th
      className="px-3 py-2 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      {label}
      {active && <span className="ml-1 text-xs">{order === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters from URL / state
  const [dateFrom, setDateFrom]       = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo]           = useState(searchParams.get('dateTo') ?? '');
  const [account, setAccount]         = useState(searchParams.get('account') ?? '');
  const [category, setCategory]       = useState(searchParams.get('category') ?? '');
  const [isIncomeFilter, setIsIncome] = useState(searchParams.get('isIncome') ?? '');
  const [search, setSearch]           = useState(searchParams.get('search') ?? '');
  const payeeFilter                    = searchParams.get('payee') ?? '';

  const [sortField, setSortField] = useState<SortField>('date');
  const [order, setOrder]         = useState<'asc' | 'desc'>('desc');
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 50;

  const [data, setData]       = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Drawer state — open if ?id= param present
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    if (dateFrom)        sp.set('dateFrom', dateFrom);
    if (dateTo)          sp.set('dateTo', dateTo);
    if (account)         sp.set('account', account);
    if (category)        sp.set('category', category);
    if (isIncomeFilter)  sp.set('isIncome', isIncomeFilter);
    if (search)          sp.set('search', search);
    if (payeeFilter)     sp.set('payee', payeeFilter);
    sp.set('sort', sortField);
    sp.set('order', order);
    sp.set('page', String(page));
    sp.set('pageSize', String(PAGE_SIZE));

    try {
      const res = await fetch(`/api/transactions?${sp.toString()}`);
      const json = (await res.json()) as TransactionsResponse;
      setData(json);

      // If ?id= is in URL, open that transaction's drawer
      const idParam = searchParams.get('id');
      if (idParam) {
        const match = json.transactions.find((t) => t.id === idParam);
        if (match) setSelectedTx(match);
      }
    } catch {
      setError('Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, account, category, isIncomeFilter, search, payeeFilter, sortField, order, page, searchParams]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setOrder('desc');
    }
    setPage(1);
  }

  function handleSaved(updated: Transaction) {
    setData((prev) =>
      prev
        ? { ...prev, transactions: prev.transactions.map((t) => (t.id === updated.id ? updated : t)) }
        : prev
    );
    setSelectedTx(updated);
  }

  function handleCloseDrawer() {
    setSelectedTx(null);
    // Remove ?id= from URL without full navigation
    const params = new URLSearchParams(searchParams.toString());
    params.delete('id');
    router.replace(`/transactions?${params.toString()}`);
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          {payeeFilter && (
            <p className="text-sm text-gray-500 mt-0.5">Filtered by payee: <strong>{payeeFilter}</strong></p>
          )}
        </div>
        {data && (
          <span className="text-sm text-gray-500">{data.total} total</span>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <input
          type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="From date"
        />
        <input
          type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="To date"
        />
        <select
          value={account} onChange={(e) => { setAccount(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All accounts</option>
          {data?.accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          {data?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={isIncomeFilter} onChange={(e) => { setIsIncome(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Income + Expenses</option>
          <option value="true">Income only</option>
          <option value="false">Expenses only</option>
        </select>
        <input
          type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search payee…"
          className="col-span-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      {loading && !data && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && data?.transactions.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No transactions found. {!payeeFilter && 'Import a CSV to get started.'}
        </div>
      )}
      {data && data.transactions.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 flex-1">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <SortHeader field="date"     label="Date"     sortField={sortField} order={order} onSort={handleSort} />
                  <SortHeader field="account"  label="Account"  sortField={sortField} order={order} onSort={handleSort} />
                  <SortHeader field="rawPayee" label="Payee"    sortField={sortField} order={order} onSort={handleSort} />
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Normalized</th>
                  <SortHeader field="category" label="Category" sortField={sortField} order={order} onSort={handleSort} />
                  <SortHeader field="amount"   label="Amount"   sortField={sortField} order={order} onSort={handleSort} />
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.transactions.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTx(t)}
                    className={`cursor-pointer hover:bg-gray-50 ${selectedTx?.id === t.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{t.date}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{t.account}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate">
                      {t.rawPayee}
                      {t.isDuplicate && <span className="ml-1 text-xs text-yellow-600" title="Duplicate">⚠</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate">{t.normalizedPayee ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {t.category ?? <span className="text-gray-300">—</span>}
                      {t.subCategory && <span className="text-gray-400"> / {t.subCategory}</span>}
                    </td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${t.isIncome ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(t.amount)}
                    </td>
                    <td className="px-3 py-2">
                      {t.isManuallyOverridden && (
                        <span className="text-purple-500 text-xs" title="Manually overridden">✎</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
                >← Prev</button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
                >Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit drawer */}
      {selectedTx && (
        <EditDrawer
          transaction={selectedTx}
          onClose={handleCloseDrawer}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
      <TransactionsContent />
    </Suspense>
  );
}
