'use client';

// UC-5: Duplicate Detection review UI
import { useCallback, useEffect, useState } from 'react';

function plural(n: number, word: string): string {
  return n === 1 ? `1 ${word}` : `${n} ${word}s`;
}
import type { DuplicateGroup } from '@/app/api/duplicates/route';
import type { Transaction } from '@/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function GroupCard({
  group,
  onResolved,
}: Readonly<{ group: DuplicateGroup; onResolved: () => void }>) {
  const [keepId, setKeepId] = useState<string>(group.transactions[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmKeep, setConfirmKeep] = useState(false);

  async function resolve(action: 'keep' | 'not-duplicate') {
    setSaving(true);
    setError(null);
    setConfirmKeep(false);
    try {
      const res = await fetch('/api/duplicates/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          keepId: action === 'keep' ? keepId : undefined,
          transactionIds: group.transactions.map((t) => t.id),
        }),
      });
      if (!res.ok) throw new Error('Request failed.');
      onResolved();
    } catch {
      setError('Failed to resolve. Please try again.');
      setSaving(false);
    }
  }

  const discardCount = group.transactions.length - 1;
  const keptTx = group.transactions.find((t) => t.id === keepId);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Group header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
        <div>
          <span className="font-medium text-gray-800">{group.rawPayee}</span>
          <span className="ml-3 text-sm text-gray-500">{group.date}</span>
          <span className={`ml-3 text-sm font-medium ${group.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(group.amount)}
          </span>
          <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
            {group.transactions.length} duplicates
          </span>
        </div>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {/* Transaction rows */}
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-8">Keep</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Account</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Source file</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Imported at</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {group.transactions.map((t: Transaction) => (
            <tr
              key={t.id}
              onClick={() => setKeepId(t.id)}
              className={`cursor-pointer hover:bg-blue-50 ${keepId === t.id ? 'bg-blue-50' : ''}`}
            >
              <td className="px-4 py-2">
                <input
                  type="radio"
                  name={`keep-${group.key}`}
                  checked={keepId === t.id}
                  onChange={() => setKeepId(t.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-blue-600"
                />
              </td>
              <td className="px-4 py-2 text-gray-700">{t.account}</td>
              <td className="px-4 py-2 text-gray-500 font-mono text-xs">{t.source}</td>
              <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                {new Date(t.importedAt).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-gray-500 text-xs">
                {t.category ?? <span className="text-gray-300">—</span>}
                {t.subCategory && ` / ${t.subCategory}`}
                {t.isManuallyOverridden && <span className="ml-1 text-purple-500" title="Manually overridden">✎</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100">
        {confirmKeep ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-700">
              Keep <strong>{keptTx?.account ?? keepId}</strong> and permanently discard{' '}
              {plural(discardCount, 'other transaction')}?
            </span>
            <button
              onClick={() => void resolve('keep')}
              disabled={saving}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Yes, discard'}
            </button>
            <button
              onClick={() => setConfirmKeep(false)}
              disabled={saving}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfirmKeep(true)}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Keep selected, discard others
            </button>
            <button
              onClick={() => void resolve('not-duplicate')}
              disabled={saving}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Mark as not duplicate'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DuplicatesPage() {
  const [groups, setGroups]   = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [rescanResult, setRescanResult] = useState<{ duplicatesFound: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/duplicates');
      const data = (await res.json()) as { groups: DuplicateGroup[] };
      setGroups(data.groups);
    } catch {
      setError('Failed to load duplicates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleRescan() {
    setRescanning(true);
    setRescanResult(null);
    try {
      const res = await fetch('/api/duplicates/rescan', { method: 'POST' });
      const data = (await res.json()) as { duplicatesFound: number };
      setRescanResult(data);
      await load();
    } catch {
      setError('Rescan failed.');
    } finally {
      setRescanning(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Duplicates</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {plural(groups.length, 'unresolved group')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {rescanResult && (
            <span className="text-xs text-blue-600">
              Rescan found {plural(rescanResult.duplicatesFound, 'flagged transaction')}.
            </span>
          )}
          <button
            onClick={() => void handleRescan()}
            disabled={rescanning}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {rescanning ? 'Rescanning…' : 'Re-scan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && groups.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No duplicate transactions found.
        </div>
      )}
      {!loading && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((g) => (
            <GroupCard key={g.key} group={g} onResolved={() => void load()} />
          ))}
        </div>
      )}
    </div>
  );
}
