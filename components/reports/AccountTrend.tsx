'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { DateRange } from './DateRangePicker';
import type { AccountTrendResponse } from '@/app/api/reports/account-trend/route';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// Shorten account names for chart legend
function shorten(s: string, max = 24) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

interface Props { dateRange: DateRange }

export default function AccountTrend({ dateRange }: Readonly<Props>) {
  const [data, setData]       = useState<AccountTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!dateRange.from || !dateRange.to) return;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    fetch(`/api/reports/account-trend?${sp.toString()}`)
      .then((r) => r.json())
      .then((d: AccountTrendResponse) => setData(d))
      .catch(() => setError('Failed to load account trend data.'))
      .finally(() => setLoading(false));
  }, [dateRange.from, dateRange.to]);

  if (loading) return <p className="text-sm text-gray-400 py-8">Loading…</p>;
  if (error)   return <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data || data.accounts.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">No account data for this period.</div>;
  }

  const { monthLabels, accounts } = data;
  const n = data.months.length;

  // Build chart data arrays: [{ label, AcctA: amt, AcctB: amt, ... }, ...]
  const incomeChartData = monthLabels.map((label, mi) => {
    const point: Record<string, number | string> = { label };
    for (const a of accounts) point[shorten(a.account)] = a.incomeByMonth[mi];
    return point;
  });

  const expenseChartData = monthLabels.map((label, mi) => {
    const point: Record<string, number | string> = { label };
    for (const a of accounts) point[shorten(a.account)] = a.expenseByMonth[mi];
    return point;
  });

  return (
    <div className="space-y-6">

      {/* ── Income stacked bar chart ──────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-2">Income by Account</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeChartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} width={72} />
              <Tooltip formatter={(value) => (typeof value === 'number' ? fmtFull(value) : '')} />
              <Legend />
              {accounts.map((a, i) => {
                const key = shorten(a.account);
                const isLast = i === accounts.length - 1;
                return (
                  <Bar
                    key={a.account}
                    dataKey={key}
                    stackId="income"
                    fill={a.color}
                    radius={isLast ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Expense stacked bar chart ─────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-2">Expense by Account</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expenseChartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} width={72} />
              <Tooltip formatter={(value) => (typeof value === 'number' ? fmtFull(value) : '')} />
              <Legend />
              {accounts.map((a, i) => {
                const key = shorten(a.account);
                const isLast = i === accounts.length - 1;
                return (
                  <Bar
                    key={a.account}
                    dataKey={key}
                    stackId="expense"
                    fill={a.color}
                    radius={isLast ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Net by account × month table ─────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 overflow-x-auto">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
          Net by Account (Income − Expense)
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Account</th>
              {monthLabels.map((lbl) => (
                <th key={lbl} className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">{lbl}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap bg-blue-50">Total Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map((a) => (
              <tr key={a.account} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-800 whitespace-nowrap flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: a.color }}
                  />
                  {a.account}
                </td>
                {a.netByMonth.map((net, i) => (
                  <td
                    key={i}
                    className={`px-3 py-2 text-right whitespace-nowrap ${
                      net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-500' : 'text-gray-300'
                    }`}
                  >
                    {net === 0 ? '—' : fmtFull(net)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right font-medium whitespace-nowrap bg-blue-50/50 ${
                  a.totalNet >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {fmtFull(a.totalNet)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-3 py-2 font-semibold text-gray-800">Total</td>
              {Array.from({ length: n }, (_, i) => {
                const total = accounts.reduce((s, a) => s + a.netByMonth[i], 0);
                return (
                  <td
                    key={i}
                    className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${
                      total > 0 ? 'text-emerald-600' : total < 0 ? 'text-red-500' : 'text-gray-300'
                    }`}
                  >
                    {total === 0 ? '—' : fmtFull(total)}
                  </td>
                );
              })}
              <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap bg-blue-50/50 ${
                accounts.reduce((s, a) => s + a.totalNet, 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {fmtFull(accounts.reduce((s, a) => s + a.totalNet, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
