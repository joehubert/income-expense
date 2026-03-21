'use client';

// UC-3A: Rules List View
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Rule } from '@/types';
import RuleEditor from '@/components/RuleEditor';
import RuleDetailPanel from '@/components/RuleDetailPanel';

interface EnrichedRule extends Rule {
  matchCount: number;
  conflictsWith: string[];
}

type Filter = 'all' | 'conflicting';

function plural(n: number, word: string): string {
  return n === 1 ? `1 ${word}` : `${n} ${word}s`;
}

function conditionSummary(rule: Rule): string {
  const parts: string[] = [];
  if (rule.account) parts.push(rule.account);
  if (rule.payeePattern) parts.push(`"${rule.payeePattern}" (${rule.payeeMatchType})`);
  if (rule.amountMin != null || rule.amountMax != null) {
    const min = rule.amountMin ?? '—';
    const max = rule.amountMax ?? '—';
    parts.push(`$${min}–$${max}`);
  }
  return parts.join(' · ') || 'No conditions';
}

function categoryLabel(rule: Rule): string {
  return rule.subCategory ? `${rule.category} / ${rule.subCategory}` : (rule.category ?? '');
}

function actionSummary(rule: Rule): string {
  const parts: string[] = [];
  if (rule.normalizedPayee) parts.push(rule.normalizedPayee);
  if (rule.category) parts.push(categoryLabel(rule));
  if (rule.isIgnored) parts.push('Ignore');
  return parts.join(' · ') || '—';
}

function RulesContent() {
  const searchParams = useSearchParams();

  const [rules, setRules] = useState<EnrichedRule[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRule, setSelectedRule] = useState<EnrichedRule | null>(null);
  // Pre-fill editor when arriving via ?newRule=1&payee=xxx from payees page
  const prefillPayee = searchParams.get('payee') ?? '';
  const [showEditor, setShowEditor] = useState(searchParams.get('newRule') === '1');
  const [editingRule, setEditingRule] = useState<EnrichedRule | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<EnrichedRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [applyAllMode, setApplyAllMode] = useState<'uncategorized' | 'force' | null>(null);
  const [confirmForceAll, setConfirmForceAll] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyAllResult, setApplyAllResult] = useState<{ affected: number } | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/rules');
      const data = (await res.json()) as { rules: EnrichedRule[] };
      setRules(data.rules);
    } catch {
      setError('Failed to load rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRules(); }, [loadRules]);

  const displayed = filter === 'conflicting'
    ? rules.filter((r) => r.conflictsWith.length > 0)
    : rules;

  async function handleSaveNew(payload: Partial<Rule>) {
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create rule.');
    await loadRules();
    setShowEditor(false);
  }

  async function handleSaveEdit(payload: Partial<Rule>) {
    if (!editingRule) return;
    const res = await fetch(`/api/rules/${editingRule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update rule.');
    await loadRules();
    setShowEditor(false);
    setEditingRule(null);
    // Refresh selected rule if it was the one edited
    if (selectedRule?.id === editingRule.id) {
      const updated = rules.find((r) => r.id === editingRule.id);
      if (updated) setSelectedRule(updated);
    }
  }

  async function handleDelete(rule: EnrichedRule) {
    setDeleting(true);
    try {
      await fetch(`/api/rules/${rule.id}`, { method: 'DELETE' });
      await loadRules();
      if (selectedRule?.id === rule.id) setSelectedRule(null);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleApplyAll(mode: 'uncategorized' | 'force') {
    setApplyingAll(true);
    setApplyAllResult(null);
    try {
      const res = await fetch('/api/rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as { affected: number };
      setApplyAllResult(data);
      await loadRules();
    } finally {
      setApplyingAll(false);
      setConfirmForceAll(false);
      setApplyAllMode(null);
    }
  }

  return (
    <div className="flex h-full gap-0 -m-6">
      {/* Left: rule list */}
      <div className={`flex flex-col min-w-0 ${selectedRule ? 'w-1/2' : 'flex-1'} p-6 overflow-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Rules</h1>
          <button
            onClick={() => { setEditingRule(null); setShowEditor(true); }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Rule
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex gap-1 mb-3">
          {(['all', 'conflicting'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f === 'conflicting' ? `Conflicting (${rules.filter((r) => r.conflictsWith.length > 0).length})` : 'All'}
            </button>
          ))}
        </div>

        {/* Apply-all controls */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setApplyAllMode('uncategorized'); void handleApplyAll('uncategorized'); }}
            disabled={applyingAll}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {applyingAll && applyAllMode === 'uncategorized' ? 'Applying…' : 'Apply All to Uncategorized'}
          </button>
          <button
            onClick={() => setConfirmForceAll(true)}
            disabled={applyingAll}
            className="rounded-md border border-orange-400 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
          >
            Force Apply All
          </button>
          {applyAllResult && (
            <span className="text-xs text-green-700">Applied to {plural(applyAllResult.affected, 'transaction')}.</span>
          )}
        </div>

        {/* Force-all confirmation */}
        {confirmForceAll && (
          <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-3 text-xs text-yellow-800">
            <p className="mb-2 font-medium">Force Apply All will overwrite all manually-edited transactions. Continue?</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setApplyAllMode('force'); void handleApplyAll('force'); }}
                disabled={applyingAll}
                className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                {applyingAll ? 'Applying…' : 'Yes, force apply'}
              </button>
              <button onClick={() => setConfirmForceAll(false)} className="rounded-md border border-yellow-400 px-3 py-1 text-xs font-medium text-yellow-700">
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* Rules table */}
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {!loading && displayed.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            {filter === 'conflicting' ? 'No conflicting rules.' : 'No rules yet — create one to start categorizing.'}
          </div>
        )}
        {!loading && displayed.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Conditions</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Matched</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map((rule) => (
                  <tr
                    key={rule.id}
                    onClick={() => setSelectedRule(selectedRule?.id === rule.id ? null : rule)}
                    className={`cursor-pointer hover:bg-gray-50 ${selectedRule?.id === rule.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <div className="text-gray-800 text-xs font-medium">{rule.description ?? conditionSummary(rule)}</div>
                      {rule.description && <div className="text-gray-400 text-xs">{conditionSummary(rule)}</div>}
                      {rule.conflictsWith.length > 0 && (
                        <span className="mt-0.5 inline-block rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">
                          ⚠ {plural(rule.conflictsWith.length, 'conflict')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{actionSummary(rule)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{rule.matchCount}</td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingRule(rule); setShowEditor(true); }}
                        className="text-xs text-blue-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(rule)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selectedRule && (
        <div className="w-1/2 shrink-0 overflow-auto border-l border-gray-200 h-full">
          <RuleDetailPanel
            rule={selectedRule}
            onClose={() => setSelectedRule(null)}
            onEdit={() => { setEditingRule(selectedRule); setShowEditor(true); }}
            onApplied={() => void loadRules()}
          />
        </div>
      )}

      {/* Rule Editor modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-auto max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">{editingRule ? 'Edit Rule' : 'New Rule'}</h2>
              <button onClick={() => { setShowEditor(false); setEditingRule(null); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5">
              <RuleEditor
                initial={editingRule ?? (prefillPayee ? { payeePattern: prefillPayee, payeeMatchType: 'substring' } : undefined)}
                onSave={editingRule ? handleSaveEdit : handleSaveNew}
                onCancel={() => { setShowEditor(false); setEditingRule(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-2">Delete Rule?</h2>
            <p className="text-sm text-gray-600 mb-1">
              This rule matched <strong>{plural(deleteTarget.matchCount, 'transaction')}</strong>.
              Deleting it will not remove their current categorization, but they will no longer be automatically re-categorized.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => void handleDelete(deleteTarget)}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
      <RulesContent />
    </Suspense>
  );
}
