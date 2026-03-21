'use client';

// UC-1: Import CSV File
import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { computeFingerprint } from '@/lib/csv';
import type { ColumnMapping } from '@/types';

type Step = 'select' | 'map' | 'preview' | 'importing' | 'done';

interface MappingFields {
  date: string;
  payee: string;
  amount: string;
  account: string;
}

interface ImportSummary {
  imported: number;
  rulesApplied: number;
  duplicatesFound: number;
  skipped: number;
  errors: string[];
}

type RawRow = Record<string, string>;

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<RawRow[]>([]);
  const [fingerprint, setFingerprint] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [mapping, setMapping] = useState<MappingFields>({ date: '', payee: '', amount: '', account: '' });
  const [accountName, setAccountName] = useState('');
  const [previewRows, setPreviewRows] = useState<RawRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep('select');
    setFileName('');
    setHeaders([]);
    setAllRows([]);
    setFingerprint('');
    setSavedNotice(false);
    setMapping({ date: '', payee: '', amount: '', account: '' });
    setAccountName('');
    setPreviewRows([]);
    setSummary(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);

    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const hdrs = results.meta.fields ?? [];
        if (hdrs.length === 0) {
          setError('No headers found in CSV file.');
          return;
        }
        const fp = computeFingerprint(hdrs);
        setHeaders(hdrs);
        setAllRows(results.data);
        setFingerprint(fp);

        // Look up saved mapping
        try {
          const res = await fetch(`/api/column-mappings?fingerprint=${encodeURIComponent(fp)}`);
          const data = (await res.json()) as { mapping: ColumnMapping | null };
          if (data.mapping) {
            setMapping({
              date: data.mapping.mappings.date,
              payee: data.mapping.mappings.payee,
              amount: data.mapping.mappings.amount,
              account: data.mapping.mappings.account ?? '',
            });
            setAccountName(data.mapping.accountName);
            setSavedNotice(true);
          } else {
            setSavedNotice(false);
            setMapping({ date: '', payee: '', amount: '', account: '' });
            setAccountName('');
          }
        } catch {
          setSavedNotice(false);
        }

        setStep('map');
      },
      error: (err: { message: string }) => {
        setError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }

  function handlePreview() {
    if (!mapping.date || !mapping.payee || !mapping.amount) {
      setError('Please map Date, Payee, and Amount columns.');
      return;
    }
    if (!accountName.trim()) {
      setError('Please enter an Account Name.');
      return;
    }
    setError(null);
    setPreviewRows(allRows.slice(0, 10));
    setStep('preview');
  }

  async function handleConfirmImport() {
    setStep('importing');
    setError(null);
    try {
      // Save mapping first
      const cm: ColumnMapping = {
        id: fingerprint,
        accountName: accountName.trim(),
        mappings: {
          date: mapping.date,
          payee: mapping.payee,
          amount: mapping.amount,
          ...(mapping.account ? { account: mapping.account } : {}),
        },
        createdAt: new Date().toISOString(),
      };
      await fetch('/api/column-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cm),
      });

      // Run import
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: allRows,
          mapping: {
            date: mapping.date,
            payee: mapping.payee,
            amount: mapping.amount,
            ...(mapping.account ? { account: mapping.account } : {}),
          },
          accountName: accountName.trim(),
          source: fileName,
          fingerprint,
        }),
      });
      const result = (await res.json()) as ImportSummary;
      setSummary(result);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStep('preview');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">Import CSV</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Step: select ── */}
      {step === 'select' && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 px-8 py-12 text-center">
          <p className="mb-4 text-gray-500 text-sm">Select a CSV file exported from Empower or AmericanExpress.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Choose CSV File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* ── Step: map ── */}
      {step === 'map' && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-500">File:</span>
            <span className="text-sm font-medium">{fileName}</span>
            <button onClick={reset} className="ml-auto text-xs text-blue-600 hover:underline">Change file</button>
          </div>

          {savedNotice && (
            <div className="mb-4 rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
              Using saved mapping for this file format.
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-4">
            <h2 className="text-base font-medium text-gray-800">Column Mapping</h2>

            <ColumnSelect label="Date *" value={mapping.date} headers={headers}
              onChange={(v) => setMapping((m) => ({ ...m, date: v }))} />
            <ColumnSelect label="Payee *" value={mapping.payee} headers={headers}
              onChange={(v) => setMapping((m) => ({ ...m, payee: v }))} />
            <ColumnSelect label="Amount *" value={mapping.amount} headers={headers}
              onChange={(v) => setMapping((m) => ({ ...m, amount: v }))} />
            <ColumnSelect label="Account (optional)" value={mapping.account} headers={headers} optional
              onChange={(v) => setMapping((m) => ({ ...m, account: v }))} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Chase Checking"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handlePreview}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {/* ── Step: preview ── */}
      {step === 'preview' && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-gray-500">File:</span>
            <span className="text-sm font-medium">{fileName}</span>
            <button onClick={() => setStep('map')} className="ml-auto text-xs text-blue-600 hover:underline">Edit mapping</button>
          </div>

          <p className="mb-3 text-sm text-gray-600">
            Preview of first {previewRows.length} row{previewRows.length !== 1 ? 's' : ''} ({allRows.length} total rows to import):
          </p>

          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-5">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Payee</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{row[mapping.date] ?? ''}</td>
                    <td className="px-3 py-2 text-gray-700">{row[mapping.payee] ?? ''}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row[mapping.amount] ?? ''}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {mapping.account && row[mapping.account] ? row[mapping.account] : accountName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirmImport}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Confirm Import
            </button>
            <button
              onClick={() => setStep('map')}
              className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* ── Step: importing ── */}
      {step === 'importing' && (
        <div className="text-center py-12 text-gray-500 text-sm">
          Importing transactions…
        </div>
      )}

      {/* ── Step: done ── */}
      {step === 'done' && summary && (
        <div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 mb-5">
            <h2 className="text-base font-semibold text-green-800 mb-3">Import Complete</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <dt className="text-gray-600">Transactions imported</dt>
              <dd className="font-medium text-gray-900">{summary.imported}</dd>
              <dt className="text-gray-600">Rules applied</dt>
              <dd className="font-medium text-gray-900">{summary.rulesApplied}</dd>
              <dt className="text-gray-600">Duplicates flagged</dt>
              <dd className="font-medium text-gray-900">{summary.duplicatesFound}</dd>
              <dt className="text-gray-600">Rows skipped (errors)</dt>
              <dd className="font-medium text-gray-900">{summary.skipped}</dd>
            </dl>
          </div>

          {summary.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-5">
              <h3 className="text-sm font-medium text-red-800 mb-2">Parse Errors</h3>
              <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                {summary.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Import Another File
            </button>
            <a
              href="/transactions"
              className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center"
            >
              View Transactions
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: column selector dropdown
function ColumnSelect({
  label,
  value,
  headers,
  optional = false,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  optional?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{optional ? '— none —' : '— select column —'}</option>
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}
