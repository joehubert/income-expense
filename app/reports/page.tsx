'use client';

// UC-7: Reports shell — tab nav + shared date range control
// Structured to accommodate future report types without refactoring.
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DateRangePicker, { type DateRange } from '@/components/reports/DateRangePicker';
import ExpenseSummary from '@/components/reports/ExpenseSummary';
import IncomeSummary from '@/components/reports/IncomeSummary';
import IncomeExpenseTrend from '@/components/reports/IncomeExpenseTrend';
import ExpenseTrend from '@/components/reports/ExpenseTrend';

type ReportTab = 'expense-summary' | 'income-summary' | 'income-expense' | 'expense-trend';

interface ReportDef {
  id: ReportTab;
  label: string;
}

// Add future report types here — no structural refactoring needed.
const REPORTS: ReportDef[] = [
  { id: 'expense-summary', label: 'Expense Summary' },
  { id: 'income-summary',  label: 'Income Summary' },
  { id: 'income-expense',  label: 'Income vs. Expense' },
  { id: 'expense-trend',   label: 'Expense Trend' },
];

function ReportsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get('tab') as ReportTab | null) ?? 'expense-summary';
  const [activeTab, setActiveTab] = useState<ReportTab>(initialTab);
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' });

  function switchTab(tab: ReportTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/reports?${params.toString()}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-5">Reports</h1>

      {/* Shared date range */}
      <div className="mb-5">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => switchTab(r.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === r.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Report content — date range passed to active report */}
      {activeTab === 'expense-summary' && <ExpenseSummary dateRange={dateRange} />}
      {activeTab === 'income-summary'  && <IncomeSummary dateRange={dateRange} />}
      {activeTab === 'income-expense'  && <IncomeExpenseTrend dateRange={dateRange} />}
      {activeTab === 'expense-trend'   && <ExpenseTrend dateRange={dateRange} />}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
      <ReportsContent />
    </Suspense>
  );
}
