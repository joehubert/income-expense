'use client';

// UC-6: Ignored Transactions
import { useCallback, useEffect, useState } from 'react';
import type { IgnoredTransaction } from '@/app/api/ignored/route';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function IgnoredPage() {
  const [transactions, setTransactions] = useState<IgnoredTransaction[]>([]);
  const [totalAmount, setTotalAmount]   = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [saving, setSaving]             = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ignored');
      const data = (await res.json()) as { transactions: IgnoredTransaction[]; totalAmount: number };
      setTransactions(data.transactions);
      setTotalAmount(data.totalAmount);
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
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t) => t.id)));
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

  const allSelected = transactions.length > 0 && selected.size === transactions.length;
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

      {/* Summary bar */}
      {!loading && transactions.length > 0 && (
        <div className="mb-4 flex gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <span><strong>{transactions.length}</strong> ignored transaction{transactions.length === 1 ? '' : 's'}</span>
          <span>Total: <strong className={totalAmount >= 0 ? 'text-green-700' : 'text-red-700'}>{fmt(totalAmount)}</strong></span>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && transactions.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No ignored transactions.
        </div>
      )}
      {!loading && transactions.length > 0 && (
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
                <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Account</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Payee</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Reason</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
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
