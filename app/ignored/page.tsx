'use client';

// UC-6: Ignored Transactions
import { useCallback, useEffect, useState } from 'react';
import type { IgnoredTransaction } from '@/app/api/ignored/route';

type SortCol = 'date' | 'account' | 'rawPayee' | 'amount' | 'reason';
type SortDir = 'asc' | 'desc';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function IgnoredPage() {
  const [transactions, setTransactions] = useState<IgnoredTransaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [saving, setSaving]             = useState(false);

  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol]       = useState<SortCol>('date');
  const [sortDir, setSortDir]       = useState<SortDir>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ignored');
      const data = (await res.json()) as { transactions: IgnoredTransaction[]; totalAmount: number };
      setTransactions(data.transactions);
      setSelected(new Set());
    } catch {
      setError('Failed to load ignored transactions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === displayed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map((t) => t.id)));
    }
  }

  async function unignore(ids: string[]) {
    if (!ids.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/ignored/unignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Request failed.');
      await load();
    } catch {
      setError('Failed to un-ignore. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleSortClick(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
  }

  function sortIndicator(col: SortCol) {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const filterLower = filterText.toLowerCase();
  const displayed = transactions
    .filter((t) => {
      if (!filterLower) return true;
      return (
        t.date.includes(filterLower) ||
        t.account.toLowerCase().includes(filterLower) ||
        t.rawPayee.toLowerCase().includes(filterLower) ||
        t.reason.toLowerCase().includes(filterLower) ||
        fmt(t.amount).includes(filterLower)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else if (sortCol === 'account') {
        cmp = a.account.localeCompare(b.account);
      } else if (sortCol === 'rawPayee') {
        cmp = a.rawPayee.localeCompare(b.rawPayee);
      } else if (sortCol === 'amount') {
        cmp = a.amount - b.amount;
      } else {
        cmp = a.reason.localeCompare(b.reason);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const displayedTotal = displayed.reduce((s, t) => s + t.amount, 0);
  const allSelected = displayed.length > 0 && displayed.every((t) => selected.has(t.id));
  const someSelected = selected.size > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Ignored Transactions</h1>
        {someSelected && (
          <button
            onClick={() => void unignore([...selected])}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : `Un-ignore ${selected.size} selected`}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Filter input */}
      {!loading && transactions.length > 0 && (
        <div className="mb-3">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by date, account, payee, amount, or reason…"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Summary bar */}
      {!loading && transactions.length > 0 && (
        <div className="mb-4 flex gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <span>
            <strong>{displayed.length}</strong>
            {filterText ? ` of ${transactions.length}` : ''} ignored transaction{displayed.length === 1 ? '' : 's'}
          </span>
          <span>Total: <strong className={displayedTotal >= 0 ? 'text-green-700' : 'text-red-700'}>{fmt(displayedTotal)}</strong></span>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && transactions.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No ignored transactions.
        </div>
      )}
      {!loading && transactions.length > 0 && displayed.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No transactions match your filter.
        </div>
      )}
      {!loading && displayed.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded accent-blue-600"
                    title={allSelected ? 'Deselect all' : 'Select all'}
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  <button onClick={() => handleSortClick('date')} className="hover:text-gray-900">
                    Date{sortIndicator('date')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  <button onClick={() => handleSortClick('account')} className="hover:text-gray-900">
                    Account{sortIndicator('account')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  <button onClick={() => handleSortClick('rawPayee')} className="hover:text-gray-900">
                    Payee{sortIndicator('rawPayee')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">
                  <button onClick={() => handleSortClick('amount')} className="hover:text-gray-900">
                    Amount{sortIndicator('amount')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">
                  <button onClick={() => handleSortClick('reason')} className="hover:text-gray-900">
                    Reason{sortIndicator('reason')}
                  </button>
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => toggleSelect(t.id)}
                  className={`cursor-pointer hover:bg-gray-50 ${selected.has(t.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      className="rounded accent-blue-600"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{t.date}</td>
                  <td className="px-3 py-2 text-gray-600">{t.account}</td>
                  <td className="px-3 py-2 text-gray-800 max-w-[220px] truncate">{t.rawPayee}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${t.isIncome ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(t.amount)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {t.reason === 'Manual'
                      ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">Manual</span>
                      : <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{t.reason}</span>
                    }
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => void unignore([t.id])}
                      disabled={saving}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Un-ignore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
