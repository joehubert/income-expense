'use client';

// UC-4: Payee Summary
import { useCallback, useEffect, useState } from 'react';
import type { PayeeSummary } from '@/app/api/payees/route';

type SortField = 'rawPayee' | 'count' | 'totalAmount';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function SortHeader({
  field, label, sortField, order, onSort,
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
      {label}{active && <span className="ml-1 text-xs">{order === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}

export default function PayeesPage() {
  const [payees, setPayees]   = useState<PayeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sortField, setSortField] = useState<SortField>('count');
  const [order, setOrder]         = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payees');
      const data = (await res.json()) as { payees: PayeeSummary[] };
      setPayees(data.payees);
    } catch {
      setError('Failed to load payees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setOrder('desc');
    }
  }

  const filtered = showAll ? payees : payees.filter((p) => p.isUnmatched);

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'rawPayee') cmp = a.rawPayee.localeCompare(b.rawPayee);
    else if (sortField === 'count') cmp = a.count - b.count;
    else cmp = a.totalAmount - b.totalAmount;
    return order === 'desc' ? -cmp : cmp;
  });

  const unmatchedCount = payees.filter((p) => p.isUnmatched).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Payee Summary</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {unmatchedCount} unmatched · {payees.length} total unique payees
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />{' '}
            Show all payees
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && sorted.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          {showAll ? 'No payees yet — import a CSV to get started.' : 'All payees have matching rules.'}
        </div>
      )}
      {!loading && sorted.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <SortHeader field="rawPayee"    label="Payee"        sortField={sortField} order={order} onSort={handleSort} />
                <SortHeader field="count"       label="Transactions" sortField={sortField} order={order} onSort={handleSort} />
                <SortHeader field="totalAmount" label="Total"        sortField={sortField} order={order} onSort={handleSort} />
                <th className="px-3 py-2 text-left font-medium text-gray-600">Range</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Matched Rule</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((p) => (
                <tr key={p.rawPayee} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800 max-w-[220px] truncate">
                    {p.rawPayee}
                    {p.isUnmatched && (
                      <span className="ml-2 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">Unmatched</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.count}</td>
                  <td className={`px-3 py-2 font-medium ${p.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(p.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                    {fmt(p.minAmount)} – {fmt(p.maxAmount)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {p.matchedRule
                      ? <span className="text-blue-600">{p.matchedRule.description ?? `Rule ${p.matchedRule.id.slice(0, 8)}`}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <a
                      href={`/rules?newRule=1&payee=${encodeURIComponent(p.rawPayee)}`}
                      className="text-xs text-blue-600 hover:underline mr-3"
                    >
                      Create Rule
                    </a>
                    <a
                      href={`/transactions?payee=${encodeURIComponent(p.rawPayee)}`}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      View Transactions
                    </a>
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
