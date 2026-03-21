'use client';

// UC-7B: Income vs. Expense monthly trend — grouped bar chart + summary table
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { DateRange } from './DateRangePicker';
import type { IncomeExpenseResponse, MonthData } from '@/app/api/reports/income-expense/route';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

interface IncomeExpenseTrendProps {
  dateRange: DateRange;
}

export default function IncomeExpenseTrend({ dateRange }: Readonly<IncomeExpenseTrendProps>) {
  const [data, setData]       = useState<IncomeExpenseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!dateRange.from || !dateRange.to) return;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    fetch(`/api/reports/income-expense?${sp.toString()}`)
      .then((r) => r.json())
      .then((d: IncomeExpenseResponse) => setData(d))
      .catch(() => setError('Failed to load trend data.'))
      .finally(() => setLoading(false));
  }, [dateRange.from, dateRange.to]);

  if (loading) return <p className="text-sm text-gray-400 py-8">Loading…</p>;
  if (error)   return <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data || data.months.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">No data for this period.</div>;
  }

  // Chart uses label for X-axis; income/expense for bars
  const chartData = data.months.map((m: MonthData) => ({
    label: m.label,
    Income: m.income,
    Expense: m.expense,
  }));

  return (
    <div className="space-y-6">
      {/* Grouped bar chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} width={72} />
            <Tooltip formatter={(value) => (typeof value === 'number' ? fmtFull(value) : '')} />
            <Legend />
            <Bar dataKey="Income"  fill="#10b981" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Expense" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Month</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Income</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Expense</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.months.map((m: MonthData) => (
              <tr key={m.month} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">{m.label}</td>
                <td className="px-3 py-2 text-right text-green-600">{fmtFull(m.income)}</td>
                <td className="px-3 py-2 text-right text-red-600">{fmtFull(m.expense)}</td>
                <td className={`px-3 py-2 text-right font-medium ${m.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {fmtFull(m.net)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-3 py-2 font-semibold text-gray-800">Total</td>
              <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtFull(data.totalIncome)}</td>
              <td className="px-3 py-2 text-right font-semibold text-red-700">{fmtFull(data.totalExpense)}</td>
              <td className={`px-3 py-2 text-right font-semibold ${data.totalNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmtFull(data.totalNet)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
