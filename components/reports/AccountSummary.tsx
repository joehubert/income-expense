'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { DateRange } from './DateRangePicker';
import type { AccountSummaryResponse } from '@/app/api/reports/account-summary/route';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// Truncate long account names for chart labels
function truncate(s: string, max = 20) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

interface Props { dateRange: DateRange }

export default function AccountSummary({ dateRange }: Readonly<Props>) {
  const [data, setData]       = useState<AccountSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!dateRange.from || !dateRange.to) return;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    fetch(`/api/reports/account-summary?${sp.toString()}`)
      .then((r) => r.json())
      .then((d: AccountSummaryResponse) => setData(d))
      .catch(() => setError('Failed to load account summary data.'))
      .finally(() => setLoading(false));
  }, [dateRange.from, dateRange.to]);

  if (loading) return <p className="text-sm text-gray-400 py-8">Loading…</p>;
  if (error)   return <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data || data.accounts.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">No account data for this period.</div>;
  }

  const chartData = data.accounts.map((a) => ({
    name:    truncate(a.account),
    full:    a.account,
    Income:  a.income,
    Expense: a.expense,
  }));

  return (
    <div className="space-y-6">

      {/* ── Grouped bar chart ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-2">Income &amp; Expense by Account</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} width={72} />
              <Tooltip
                formatter={(value, name) => (typeof value === 'number' ? fmtFull(value) : '')}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.full ?? label}
              />
              <Legend verticalAlign="top" />
              <Bar dataKey="Income"  fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Expense" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Summary table ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Account</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Income</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Expense</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.accounts.map((a) => (
              <tr key={a.account} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-800">{a.account}</td>
                <td className="px-3 py-2 text-right text-emerald-600">
                  {a.income > 0 ? fmtFull(a.income) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-right text-red-500">
                  {a.expense > 0 ? fmtFull(a.expense) : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-3 py-2 text-right font-medium ${a.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmtFull(a.net)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-3 py-2 font-semibold text-gray-800">Total</td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-600">{fmtFull(data.totalIncome)}</td>
              <td className="px-3 py-2 text-right font-semibold text-red-500">{fmtFull(data.totalExpense)}</td>
              <td className={`px-3 py-2 text-right font-semibold ${data.totalNet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {fmtFull(data.totalNet)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
