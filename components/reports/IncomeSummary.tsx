'use client';

// UC-7B: Income Summary — pie chart + expandable table
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DateRange } from './DateRangePicker';
import type {
  IncomeSummaryResponse,
  CategoryBreakdown,
  SubCategoryBreakdown,
} from '@/app/api/reports/income-summary/route';

const COLORS = [
  '#10b981','#3b82f6','#f59e0b','#8b5cf6','#06b6d4',
  '#84cc16','#f97316','#ec4899','#6366f1','#ef4444',
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

interface IncomeSummaryProps {
  dateRange: DateRange;
}

function CategoryRow({
  cat, index, totalIncome,
}: Readonly<{ cat: CategoryBreakdown; index: number; totalIncome: number }>) {
  const [open, setOpen] = useState(false);
  const color = COLORS[index % COLORS.length];

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-2 font-medium text-gray-800">
          <span className="mr-2 text-xs text-gray-400">{open ? '▼' : '▶'}</span>
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: color }} />
          {cat.category}
        </td>
        <td className="px-3 py-2 text-right font-medium text-emerald-600">{fmt(cat.amount)}</td>
        <td className="px-3 py-2 text-right text-gray-500">{pct(cat.percentage)}</td>
        <td className="px-3 py-2 text-right text-gray-400 text-xs">{pct((cat.amount / totalIncome) * 100)}</td>
      </tr>

      {open && cat.subCategories.map((sub) => (
        <SubCategoryRow key={sub.subCategory || '__none__'} sub={sub} totalIncome={totalIncome} />
      ))}
    </>
  );
}

function SubCategoryRow({
  sub, totalIncome,
}: Readonly<{ sub: SubCategoryBreakdown; totalIncome: number }>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer bg-gray-50 hover:bg-gray-100"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-1.5 pl-8 text-gray-700 text-sm">
          <span className="mr-2 text-xs text-gray-400">{open ? '▼' : '▶'}</span>
          {sub.subCategory || <span className="italic text-gray-400">No sub-category</span>}
        </td>
        <td className="px-3 py-1.5 text-right text-sm text-emerald-500">{fmt(sub.amount)}</td>
        <td className="px-3 py-1.5 text-right text-sm text-gray-400">{pct(sub.percentage)}</td>
        <td className="px-3 py-1.5 text-right text-xs text-gray-400">{pct((sub.amount / totalIncome) * 100)}</td>
      </tr>

      {open && sub.payees.map((p) => (
        <tr key={p.payee} className="bg-gray-100">
          <td className="px-3 py-1 pl-14 text-gray-600 text-xs">{p.payee}</td>
          <td className="px-3 py-1 text-right text-xs text-emerald-400">{fmt(p.amount)}</td>
          <td className="px-3 py-1 text-right text-xs text-gray-400">{p.count} txn{p.count === 1 ? '' : 's'}</td>
          <td className="px-3 py-1"></td>
        </tr>
      ))}
    </>
  );
}

export default function IncomeSummary({ dateRange }: Readonly<IncomeSummaryProps>) {
  const [data, setData]       = useState<IncomeSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!dateRange.from || !dateRange.to) return;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    fetch(`/api/reports/income-summary?${sp.toString()}`)
      .then((r) => r.json())
      .then((d: IncomeSummaryResponse) => setData(d))
      .catch(() => setError('Failed to load income data.'))
      .finally(() => setLoading(false));
  }, [dateRange.from, dateRange.to]);

  if (loading) return <p className="text-sm text-gray-400 py-8">Loading…</p>;
  if (error)   return <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data || data.categories.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">No income data for this period.</div>;
  }

  const pieData = data.categories.map((c) => ({ name: c.category, value: c.amount }));

  return (
    <div className="space-y-6">
      {/* Pie chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name ?? ''} ${((percent ?? 0) * 100).toFixed(1)}%`
              }
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => (typeof value === 'number' ? fmt(value) : '')} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Companion table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">% of Total</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 text-xs">of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.categories.map((cat, i) => (
              <CategoryRow key={cat.category} cat={cat} index={i} totalIncome={data.totalIncome} />
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-3 py-2 font-semibold text-gray-800">Total</td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-600">{fmt(data.totalIncome)}</td>
              <td className="px-3 py-2 text-right text-gray-500">100%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
