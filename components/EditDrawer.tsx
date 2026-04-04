'use client';

// UC-2: Edit Drawer — slide-in panel for editing a transaction
import { useEffect, useState } from 'react';
import type { Transaction, CategoryEntry } from '@/types';

interface EditDrawerProps {
  transaction: Transaction;
  onClose: () => void;
  onSaved: (updated: Transaction) => void;
}

export default function EditDrawer({ transaction: t, onClose, onSaved }: EditDrawerProps) {
  const [normalizedPayee, setNormalizedPayee] = useState(t.normalizedPayee ?? '');
  const [category, setCategory] = useState(t.category ?? '');
  const [subCategory, setSubCategory] = useState(t.subCategory ?? '');
  const [notes, setNotes] = useState(t.notes ?? '');
  const [isIgnored, setIsIgnored] = useState(t.isIgnored);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d: { categories: CategoryEntry[] }) => setCategories(d.categories))
      .catch(() => null);
  }, []);

  // Reset form when transaction changes
  useEffect(() => {
    setNormalizedPayee(t.normalizedPayee ?? '');
    setCategory(t.category ?? '');
    setSubCategory(t.subCategory ?? '');
    setNotes(t.notes ?? '');
    setIsIgnored(t.isIgnored);
    setError(null);
  }, [t.id, t.normalizedPayee, t.category, t.subCategory, t.notes, t.isIgnored]);

  const categoryNames = [...new Set(categories.map((c) => c.category))].sort((a, b) => a.localeCompare(b));
  const subCategoryNames = [
    ...new Set(categories.filter((c) => c.category === category).map((c) => c.subCategory).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          normalizedPayee: normalizedPayee || null,
          category: category || null,
          subCategory: subCategory || null,
          notes: notes || null,
          isIgnored,
        }),
      });
      if (!res.ok) throw new Error('Save failed.');
      const data = (await res.json()) as { transaction: Transaction };
      onSaved(data.transaction);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-96 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400">{t.date} · {t.account}</p>
            <p className="font-semibold text-gray-900 mt-0.5">{t.rawPayee}</p>
            <p className={`text-sm font-medium mt-0.5 ${t.isIncome ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(t.amount)}
              <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${t.isIncome ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {t.isIncome ? 'Income' : 'Expense'}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4">&times;</button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {t.isManuallyOverridden && (
            <div className="rounded-md bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-700">
              ✎ Manually overridden — rule re-application is skipped unless Force Apply is used.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Normalized Payee</label>
            <input
              type="text"
              value={normalizedPayee}
              onChange={(e) => setNormalizedPayee(e.target.value)}
              placeholder={t.rawPayee}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setSubCategory(''); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— none —</option>
              {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Category</label>
            <select
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              disabled={!category}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">— none —</option>
              {subCategoryNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className={`rounded-md border px-3 py-3 ${isIgnored ? 'border-amber-200 bg-amber-50' : 'border-gray-200'}`}>
            <div className="flex items-start gap-2">
              <input
                id="ignore-toggle"
                type="checkbox"
                checked={isIgnored}
                onChange={(e) => setIsIgnored(e.target.checked)}
                className="mt-0.5 rounded cursor-pointer"
              />
              <label htmlFor="ignore-toggle" className="cursor-pointer">
                <p className="text-sm font-medium text-gray-700">Ignore this transaction</p>
                <p className="text-xs text-gray-500">Excluded from all reports and analysis.</p>
              </label>
            </div>
          </div>

          {/* Read-only info */}
          <div className="pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-500">
            <p>Source: {t.source}</p>
            <p>Imported: {new Date(t.importedAt).toLocaleString()}</p>
            {t.isDuplicate && <p className="text-yellow-600">⚠ Flagged as duplicate</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
