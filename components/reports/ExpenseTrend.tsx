'use client';

// UC-7C: Expense Trend — stacked bar charts by category/sub-category + summary tables
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';
import type { DateRange } from './DateRangePicker';
import type {
  ExpenseTrendResponse,
  CategoryTrend,
  SubCategoryTrend,
} from '@/app/api/reports/expense-trend/route';

// Sub-category palette — offset from category colors to stay distinct
const SUB_COLORS = [
  '#60a5fa','#f87171','#34d399','#fbbf24','#a78bfa',
  '#22d3ee','#fb923c','#f472b6','#a3e635','#818cf8',
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

interface Props { dateRange: DateRange }

export default function ExpenseTrend({ dateRange }: Readonly<Props>) {
  const [data, setData]                     = useState<ExpenseTrendResponse | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!dateRange.from || !dateRange.to) return;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    fetch(`/api/reports/expense-trend?${sp.toString()}`)
      .then((r) => r.json())
      .then((d: ExpenseTrendResponse) => {
        setData(d);
        // Reset selection if selected category no longer exists in new data
        setSelectedCategory((prev) =>
          prev && d.categories.some((c) => c.category === prev) ? prev : null
        );
      })
      .catch(() => setError('Failed to load expense trend data.'))
      .finally(() => setLoading(false));
  }, [dateRange.from, dateRange.to]);

  if (loading) return <p className="text-sm text-gray-400 py-8">Loading…</p>;
  if (error)   return <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data || data.categories.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">No expense data for this period.</div>;
  }

  const { months, monthLabels, categories, totalByMonth } = data;
  const n = months.length;

  // Build top chart data: [{ label, Cat1: amt, Cat2: amt, ... }, ...]
  const topChartData = monthLabels.map((label, mi) => {
    const point: Record<string, number | string> = { label };
    for (const cat of categories) point[cat.category] = cat.amountByMonth[mi];
    return point;
  });

  // Selected category object
  const selectedCat = selectedCategory
    ? categories.find((c) => c.category === selectedCategory) ?? null
    : null;

  // Build drill-down chart data
  const drillChartData = selectedCat
    ? monthLabels.map((label, mi) => {
        const point: Record<string, number | string> = { label };
        for (const sub of selectedCat.subCategories) {
          point[sub.subCategory || '(none)'] = sub.amountByMonth[mi];
        }
        return point;
      })
    : [];

  return (
    <div className="space-y-6">

      {/* ── Top chart: stacked by category ───────────────────────────────── */}
      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-2">
          Expenses by Category — click a segment to drill down
        </h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topChartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} width={72} />
              <Tooltip formatter={(value) => (typeof value === 'number' ? fmtFull(value) : '')} />
              <Legend />
              {categories.map((cat) => (
                <Bar
                  key={cat.category}
                  dataKey={cat.category}
                  stackId="a"
                  fill={cat.color}
                  radius={cat === categories[categories.length - 1] ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  style={{ cursor: 'pointer', opacity: selectedCategory && selectedCategory !== cat.category ? 0.4 : 1 }}
                  onClick={() => setSelectedCategory((prev) => prev === cat.category ? null : cat.category)}
                >
                  {/* Cell needed to keep fill + opacity consistent */}
                  {topChartData.map((_, i) => (
                    <Cell key={i} fill={cat.color} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Drill-down chart: stacked by sub-category ────────────────────── */}
      {selectedCat && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-medium text-gray-600">
              {selectedCat.category} — by Sub-Category
            </h2>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-400 transition-colors"
            >
              ✕ clear
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={drillChartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} width={72} />
                <Tooltip formatter={(value) => (typeof value === 'number' ? fmtFull(value) : '')} />
                <Legend />
                {selectedCat.subCategories.map((sub, i) => {
                  const key = sub.subCategory || '(none)';
                  const isLast = i === selectedCat.subCategories.length - 1;
                  return (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="b"
                      fill={SUB_COLORS[i % SUB_COLORS.length]}
                      radius={isLast ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Table 1: categories × months ─────────────────────────────────── */}
      <CategoryTable
        categories={categories}
        monthLabels={monthLabels}
        totalByMonth={totalByMonth}
        n={n}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory((prev) => prev === cat ? null : cat)}
      />

      {/* ── Table 2: sub-categories × months (only when selection active) ── */}
      {selectedCat && (
        <SubCategoryTable
          cat={selectedCat}
          monthLabels={monthLabels}
          n={n}
        />
      )}
    </div>
  );
}

// ── Table 1 component ──────────────────────────────────────────────────────────

interface CategoryTableProps {
  categories: CategoryTrend[];
  monthLabels: string[];
  totalByMonth: number[];
  n: number;
  selectedCategory: string | null;
  onSelectCategory: (cat: string) => void;
}

function CategoryTable({
  categories, monthLabels, totalByMonth, n, selectedCategory, onSelectCategory,
}: Readonly<CategoryTableProps>) {
  const grandTotal = totalByMonth.reduce((s, v) => s + v, 0);
  const overallAvg = n > 0 ? grandTotal / n : 0;

  return (
    <div className="rounded-lg border border-gray-200 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Category</th>
            {monthLabels.map((lbl) => (
              <th key={lbl} className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">{lbl}</th>
            ))}
            <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap bg-blue-50">Avg/Mo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.category;
            return (
              <tr
                key={cat.category}
                onClick={() => onSelectCategory(cat.category)}
                className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: cat.color }}
                  />
                  {cat.category}
                </td>
                {cat.amountByMonth.map((amt, i) => (
                  <td key={i} className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                    {amt === 0 ? <span className="text-gray-300">—</span> : fmtFull(amt)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap bg-blue-50/50">
                  {fmtFull(cat.monthlyAvg)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
          <tr>
            <td className="px-3 py-2 font-semibold text-gray-800">Total</td>
            {totalByMonth.map((amt, i) => (
              <td key={i} className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                {amt === 0 ? <span className="text-gray-300">—</span> : fmtFull(amt)}
              </td>
            ))}
            <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap bg-blue-50/50">
              {fmtFull(overallAvg)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Table 2 component ──────────────────────────────────────────────────────────

interface SubCategoryTableProps {
  cat: CategoryTrend;
  monthLabels: string[];
  n: number;
}

function SubCategoryTable({ cat, monthLabels, n }: Readonly<SubCategoryTableProps>) {
  const totalByMonth = monthLabels.map((_, i) =>
    cat.subCategories.reduce((s, sub) => s + sub.amountByMonth[i], 0)
  );
  const grandTotal = totalByMonth.reduce((s, v) => s + v, 0);
  const overallAvg = n > 0 ? grandTotal / n : 0;

  return (
    <div className="rounded-lg border border-gray-200 overflow-x-auto">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
        {cat.category} — Sub-Category Breakdown
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Sub-Category</th>
            {monthLabels.map((lbl) => (
              <th key={lbl} className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">{lbl}</th>
            ))}
            <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap bg-blue-50">Avg/Mo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {cat.subCategories.map((sub: SubCategoryTrend, i) => (
            <tr key={sub.subCategory || '(none)'} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: SUB_COLORS[i % SUB_COLORS.length] }}
                />
                {sub.subCategory || <span className="text-gray-400 italic">(none)</span>}
              </td>
              {sub.amountByMonth.map((amt, mi) => (
                <td key={mi} className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                  {amt === 0 ? <span className="text-gray-300">—</span> : fmtFull(amt)}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap bg-blue-50/50">
                {fmtFull(sub.monthlyAvg)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
          <tr>
            <td className="px-3 py-2 font-semibold text-gray-800">Total</td>
            {totalByMonth.map((amt, i) => (
              <td key={i} className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                {amt === 0 ? <span className="text-gray-300">—</span> : fmtFull(amt)}
              </td>
            ))}
            <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap bg-blue-50/50">
              {fmtFull(overallAvg)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
