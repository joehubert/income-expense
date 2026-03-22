'use client';

// UC-3B: Rule Editor — create or edit a rule
import { useEffect, useState } from 'react';
import type { Rule, CategoryEntry } from '@/types';

interface RuleEditorProps {
  initial?: Partial<Rule>;   // pre-fill (e.g. from payee row)
  onSave: (rule: Partial<Rule>) => Promise<void>;
  onCancel: () => void;
}

type MatchType = 'substring' | 'exact' | 'regex';

interface FormState {
  description: string;
  account: string;
  payeePattern: string;
  payeeMatchType: MatchType;
  amountMin: string;
  amountMax: string;
  normalizedPayee: string;
  category: string;
  subCategory: string;
  isIgnored: boolean;
}

const EMPTY: FormState = {
  description: '',
  account: '',
  payeePattern: '',
  payeeMatchType: 'exact',
  amountMin: '',
  amountMax: '',
  normalizedPayee: '',
  category: '',
  subCategory: '',
  isIgnored: false,
};

export default function RuleEditor({ initial, onSave, onCancel }: RuleEditorProps) {
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    description: initial?.description ?? '',
    account: initial?.account ?? '',
    payeePattern: initial?.payeePattern ?? '',
    payeeMatchType: initial?.payeeMatchType ?? 'exact',
    amountMin: initial?.amountMin != null ? String(initial.amountMin) : '',
    amountMax: initial?.amountMax != null ? String(initial.amountMax) : '',
    normalizedPayee: initial?.normalizedPayee ?? initial?.payeePattern ?? '',
    category: initial?.category ?? '',
    subCategory: initial?.subCategory ?? '',
    isIgnored: initial?.isIgnored ?? false,
  });

  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [knownAccounts, setKnownAccounts] = useState<string[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  useEffect(() => {
    let done = 0;
    function checkDone() { done++; if (done === 2) setLoadingMeta(false); }

    fetch('/api/categories')
      .then((r) => r.json())
      .then((d: { categories: CategoryEntry[] }) => setCategories(d.categories))
      .catch(() => null)
      .finally(checkDone);

    // Derive known accounts from transactions
    fetch('/api/transactions?limit=9999')
      .then((r) => r.json())
      .then((d: { transactions: { account: string }[] }) => {
        const accounts = [...new Set(d.transactions.map((t) => t.account))].filter(Boolean);
        setKnownAccounts(accounts);
      })
      .catch(() => null)
      .finally(checkDone);
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'category') setForm((f) => ({ ...f, [key]: value as string, subCategory: '' }));
  }

  function hasCondition(): boolean {
    return !!(form.account || form.payeePattern || form.amountMin || form.amountMax);
  }

  const categoryNames = [...new Set(categories.map((c) => c.category))].sort();
  const subCategoryNames = [
    ...new Set(
      categories
        .filter((c) => c.category === form.category)
        .map((c) => c.subCategory)
        .filter(Boolean)
    ),
  ].sort();

  async function handleAddCategory() {
    const cat = newCategory.trim();
    if (!cat) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: cat, subCategory: '' }),
    });
    setCategories((prev) => [...prev, { category: cat, subCategory: '' }]);
    setForm((f) => ({ ...f, category: cat, subCategory: '' }));
    setNewCategory('');
  }

  async function handleAddSubCategory() {
    const sub = newSubCategory.trim();
    if (!sub || !form.category) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: form.category, subCategory: sub }),
    });
    setCategories((prev) => [...prev, { category: form.category, subCategory: sub }]);
    setForm((f) => ({ ...f, subCategory: sub }));
    setNewSubCategory('');
  }

  async function handleSave() {
    if (!hasCondition()) {
      setError('At least one condition (account, payee, or amount) is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setConflicts([]);

    const payload: Partial<Rule> = {
      description: form.description || null,
      account: form.account || null,
      payeePattern: form.payeePattern || null,
      payeeMatchType: form.payeeMatchType,
      amountMin: form.amountMin !== '' ? parseFloat(form.amountMin) : null,
      amountMax: form.amountMax !== '' ? parseFloat(form.amountMax) : null,
      normalizedPayee: form.normalizedPayee || null,
      category: form.category || null,
      subCategory: form.subCategory || null,
      isIgnored: form.isIgnored ? true : null,
    };

    try {
      await onSave(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSaving(false);
    }
    void conflicts;
  }

  if (loadingMeta) {
    return <p className="text-sm text-gray-400 py-4">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Description (optional)</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="e.g. Starbucks purchases"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Conditions */}
      <fieldset className="rounded-lg border border-gray-200 p-4 space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Conditions</legend>

        {/* Account */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
          <select
            value={form.account}
            onChange={(e) => set('account', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— any account —</option>
            {knownAccounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Payee Pattern */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payee Pattern</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.payeePattern}
              onChange={(e) => set('payeePattern', e.target.value)}
              placeholder="e.g. STARBUCKS"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.payeeMatchType}
              onChange={(e) => set('payeeMatchType', e.target.value as MatchType)}
              className="rounded-md border border-gray-300 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="substring">Substring</option>
              <option value="exact">Exact</option>
              <option value="regex">Regex</option>
            </select>
          </div>
        </div>

        {/* Amount Range */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Min</label>
            <input
              type="number"
              step="0.01"
              value={form.amountMin}
              onChange={(e) => set('amountMin', e.target.value)}
              placeholder="e.g. -100"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Max</label>
            <input
              type="number"
              step="0.01"
              value={form.amountMax}
              onChange={(e) => set('amountMax', e.target.value)}
              placeholder="e.g. 0"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Actions */}
      <fieldset className="rounded-lg border border-gray-200 p-4 space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Actions</legend>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Normalized Payee</label>
          <input
            type="text"
            value={form.normalizedPayee}
            onChange={(e) => set('normalizedPayee', e.target.value)}
            placeholder="e.g. Starbucks"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category with inline create */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <div className="flex gap-2">
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— none —</option>
              {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddCategory(); } }}
              placeholder="Create new category…"
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => void handleAddCategory()}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Add
            </button>
          </div>
        </div>

        {/* Sub-category with inline create */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Category</label>
          <select
            value={form.subCategory}
            onChange={(e) => set('subCategory', e.target.value)}
            disabled={!form.category}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">— none —</option>
            {subCategoryNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {form.category && (
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={newSubCategory}
                onChange={(e) => setNewSubCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddSubCategory(); } }}
                placeholder="Create new sub-category…"
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => void handleAddSubCategory()}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Is Ignored toggle */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Mark as Ignored</label>
          <button
            type="button"
            onClick={() => set('isIgnored', !form.isIgnored)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isIgnored ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.isIgnored ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </fieldset>

      {/* Footer */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={() => void handleSave()}
          disabled={saving || newCategory.trim() !== '' || newSubCategory.trim() !== ''}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Rule'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
