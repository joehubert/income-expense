// UC-1: Import pipeline API
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions, writeTransactions, readRules } from '@/lib/data';
import { parseDate, parseAmount } from '@/lib/csv';
import { applyRules } from '@/lib/rules';
import { detectDuplicates } from '@/lib/duplicates';
import type { Transaction } from '@/types';

interface RawRow {
  [key: string]: string;
}

interface ImportRequest {
  rows: RawRow[];
  mapping: {
    date: string;
    payee: string;
    amount: string;
    account?: string;
  };
  accountName: string;
  source: string;       // original filename
  fingerprint: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ImportRequest;
  const { rows, mapping, accountName, source } = body;

  const imported: Transaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row[mapping.date] ?? '';
    const rawPayee = row[mapping.payee] ?? '';
    const rawAmount = row[mapping.amount] ?? '';

    const date = parseDate(rawDate);
    const amount = parseAmount(rawAmount);

    if (!date) {
      errors.push(`Row ${i + 2}: invalid date "${rawDate}"`);
      continue;
    }
    if (amount === null) {
      errors.push(`Row ${i + 2}: invalid amount "${rawAmount}"`);
      continue;
    }
    if (!rawPayee.trim()) {
      errors.push(`Row ${i + 2}: missing payee`);
      continue;
    }

    const account =
      mapping.account && row[mapping.account]
        ? row[mapping.account]
        : accountName;

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      date,
      amount,
      isIncome: amount > 0,
      account,
      source,
      rawPayee: rawPayee.trim(),
      normalizedPayee: null,
      category: null,
      subCategory: null,
      isIgnored: false,
      isDuplicate: false,
      isManuallyOverridden: false,
      isDiscarded: false,
      importedAt: new Date().toISOString(),
      notes: null,
    };

    imported.push(transaction);
  }

  // Apply rules in import mode (UC-3D): all rules, skip isManuallyOverridden (none for new imports)
  const rules = readRules();
  const withRules = applyRules(imported, rules, 'import');
  const rulesApplied = withRules.filter(
    (t) => t.category !== null || t.normalizedPayee !== null || t.isIgnored
  ).length;

  // Duplicate detection
  const existing = readTransactions();
  const { updatedExisting, flaggedIncoming, duplicatesFound } = detectDuplicates(
    existing,
    withRules
  );

  // Persist: write updated existing + new transactions
  writeTransactions([...updatedExisting, ...flaggedIncoming]);

  return NextResponse.json({
    imported: flaggedIncoming.length,
    rulesApplied,
    duplicatesFound,
    skipped: errors.length,
    errors,
  });
}
