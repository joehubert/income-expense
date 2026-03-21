'use client';

// UC-3C: Rule Detail Panel — matched transactions + inline edit + apply buttons
import { useEffect, useState } from 'react';

function plural(n: number, word: string): string {
  return n === 1 ? `1 ${word}` : `${n} ${word}s`;
}
import type { Rule, Transaction, CategoryEntry } from '@/types';

interface EnrichedRule extends Rule {
  matchCount: number;
  conflictsWith: string[];
}

interface RuleDetailPanelProps {
  rule: EnrichedRule;
  onClose: () => void;
  onEdit: () => void;
  onApplied: () => void;
}

interface InlineEditState {
  normalizedPayee: string;
  category: string;
  subCategory: string;
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function conditionSummary(rule: Rule): string {
  const parts: string[] = [];
  if (rule.account) parts.push(`Account: ${rule.account}`);
  if (rule.payeePattern) parts.push(`Payee ${rule.payeeMatchType}: "${rule.payeePattern}"`);
  if (rule.amountMin != null || rule.amountMax != null) {
    const min = rule.amountMin != null ? fmt(rule.amountMin) : '—';
    const max = rule.amountMax != null ? fmt(rule.amountMax) : '—';
    parts.push(`Amount: ${min} to ${max}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No conditions';
}

function actionSummary(rule: Rule): string {
  const parts: string[] = [];
  if (rule.normalizedPayee) parts.push(`Payee → ${rule.normalizedPayee}`);
  if (rule.category) parts.push(`Category → ${rule.category}${rule.subCategory ? ` / ${rule.subCategory}` : ''}`);
  if (rule.isIgnored) parts.push('Mark ignored');
  return parts.length > 0 ? parts.join(' · ') : 'No actions';
}

export default function RuleDetailPanel({ rule, onClose, onEdit, onApplied }: RuleDetailPanelProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<InlineEditState>({ normalizedPayee: '', category: '', subCategory: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [applyMode, setApplyMode] = useState<'uncategorized' | 'force' | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ affected: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setApplyResult(null);
    Promise.all([
      fetch(`/api/rules/${rule.id}/transactions`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([txData, catData]: [{ transactions: Transaction[] }, { categories: CategoryEntry[] }]) => {
        setTransactions(txData.transactions);
        setCategories(catData.categories);
      })
      .catch(() => setError('Failed to load transactions.'))
      .finally(() => setLoading(false));
  }, [rule.id]);

  const categoryNames = [...new Set(categories.map((c) => c.category))].sort();
  const subCategoryNames = [
    ...new Set(
      categories
        .filter((c) => c.category === editForm.category)
        .map((c) => c.subCategory)
        .filter(Boolean)
    ),
  ].sort();

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditForm({
      normalizedPayee: t.normalizedPayee ?? '',
      category: t.category ?? '',
      subCategory: t.subCategory ?? '',
    });
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          normalizedPayee: editForm.normalizedPayee || null,
          category: editForm.category || null,
          subCategory: editForm.subCategory || null,
        }),
      });
      const data = (await res.json()) as { transaction: Transaction };
      setTransactions((prev) => prev.map((t) => (t.id === id ? data.transaction : t)));
      setEditingId(null);
    } catch {
      setError('Failed to save.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleApply(mode: 'uncategorized' | 'force') {
    setApplying(true);
    setApplyResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/rules/${rule.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as { affected: number };
      setApplyResult(data);
      // Refresh matched transactions
      const txRes = await fetch(`/api/rules/${rule.id}/transactions`);
      const txData = (await txRes.json()) as { transactions: Transaction[] };
      setTransactions(txData.transactions);
      onApplied();
    } catch {
      setError('Apply failed.');
    } finally {
      setApplying(false);
      setConfirmForce(false);
      setApplyMode(null);
    }
  }

  const overrideCount = transactions.filter((t) => t.isManuallyOverridden).length;
  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
  const dates = transactions.map((t) => t.date).sort();

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">{conditionSummary(rule)}</p>
          <p className="text-xs text-blue-700">{actionSummary(rule)}</p>
          {rule.conflictsWith.length > 0 && (
            <span className="mt-1 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              {plural(rule.conflictsWith.length, 'conflict')}
            </span>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex gap-4 text-xs text-gray-600">
        <span><strong>{transactions.length}</strong> transactions</span>
        <span><strong>{fmt(totalAmount)}</strong> total</span>
        {dates.length > 0 && <span>{dates[0]} – {dates[dates.length - 1]}</span>}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className="mx-4 mt-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
          Applied to {plural(applyResult.affected, 'transaction')}.
        </div>
      )}

      {/* Force-apply confirmation */}
      {confirmForce && (
        <div className="mx-4 mt-3 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-3 text-xs text-yellow-800">
          <p className="mb-2 font-medium">Force Apply will overwrite {plural(overrideCount, 'manually-edited transaction')}. Continue?</p>
          <div className="flex gap-2">
            <button
              onClick={() => void handleApply('force')}
              disabled={applying}
              className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
            >
              {applying ? 'Applying…' : 'Yes, force apply'}
            </button>
            <button onClick={() => setConfirmForce(false)} className="rounded-md border border-yellow-400 px-3 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Apply buttons */}
      <div className="px-4 py-2 border-b border-gray-200 flex gap-2">
        <button
          onClick={() => { setApplyMode('uncategorized'); void handleApply('uncategorized'); }}
          disabled={applying || applyMode === 'uncategorized'}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {applying && applyMode === 'uncategorized' ? 'Applying…' : 'Apply to Uncategorized'}
        </button>
        <button
          onClick={() => setConfirmForce(true)}
          disabled={applying}
          className="rounded-md border border-orange-400 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
        >
          Force Apply
        </button>
      </div>

      {/* Transactions table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No transactions matched.</p>
        ) : (
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Payee</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Category</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) =>
                editingId === t.id ? (
                  <tr key={t.id} className="bg-blue-50">
                    <td className="px-3 py-2 text-gray-600">{t.date}</td>
                    <td className="px-3 py-2">
                      <input
                        value={editForm.normalizedPayee}
                        onChange={(e) => setEditForm((f) => ({ ...f, normalizedPayee: e.target.value }))}
                        placeholder={t.rawPayee}
                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(t.amount)}</td>
                    <td className="px-3 py-2" colSpan={1}>
                      <div className="flex gap-1">
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value, subCategory: '' }))}
                          className="border border-gray-300 rounded px-1 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">— none —</option>
                          {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select
                          value={editForm.subCategory}
                          onChange={(e) => setEditForm((f) => ({ ...f, subCategory: e.target.value }))}
                          disabled={!editForm.category}
                          className="border border-gray-300 rounded px-1 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="">— sub —</option>
                          {subCategoryNames.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => void saveEdit(t.id)}
                        disabled={savingEdit}
                        className="text-blue-600 hover:underline mr-2 disabled:opacity-50"
                      >Save</button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">×</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600">{t.date}</td>
                    <td className="px-3 py-2 text-gray-800">
                      <span>{t.normalizedPayee ?? t.rawPayee}</span>
                      {t.isManuallyOverridden && (
                        <span className="ml-1 text-xs text-purple-600" title="Manually overridden">✎</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt(t.amount)}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {t.category ?? <span className="text-gray-300">—</span>}
                      {t.subCategory && <span className="text-gray-400"> / {t.subCategory}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => startEdit(t)}
                        className="text-blue-600 hover:underline mr-2"
                      >Edit</button>
                      <a
                        href={`/transactions?id=${t.id}`}
                        className="text-gray-400 hover:text-gray-600"
                        title="View in Transactions"
                      >↗</a>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
