// Sidebar badge counts: unmatched payees, conflicting rules, unresolved duplicates
import { NextResponse } from 'next/server';
import { readTransactions, readRules } from '@/lib/data';
import { buildConflictMap, matchesRule, getSpecificity } from '@/lib/rules';
import type { Transaction, Rule } from '@/types';

function payeeHasRule(rawPayee: string, rules: Rule[]): boolean {
  const synthetic: Transaction = {
    id: '', date: '', amount: 0, isIncome: false, account: '', source: '',
    rawPayee, normalizedPayee: null, category: null, subCategory: null,
    isIgnored: false, isDuplicate: false, isManuallyOverridden: false,
    isDiscarded: false, importedAt: '', notes: null,
  };
  const sorted = [...rules].sort((a, b) => getSpecificity(a) - getSpecificity(b));
  return sorted.some((r) => r.payeePattern !== null && matchesRule(r, synthetic));
}

export async function GET() {
  const transactions = readTransactions().filter((t) => !t.isDiscarded && !t.isIgnored);
  const rules = readRules();

  // Distinct payees with no matching rule
  const uniquePayees = [...new Set(transactions.map((t) => t.rawPayee))];
  const payeesWithNoRule = uniquePayees.filter((p) => !payeeHasRule(p, rules)).length;

  // Conflicting rules
  const conflictMap = buildConflictMap(rules);
  const conflictingRules = [...conflictMap.values()].filter((s) => s.size > 0).length;

  // Unresolved duplicate groups (transactions where isDuplicate=true and isDiscarded=false)
  const dupTransactions = transactions.filter((t) => t.isDuplicate && !t.isDiscarded);
  const dupGroups = new Set(dupTransactions.map((t) => `${t.date}|${t.rawPayee}|${t.amount}`));
  const unresolvedDuplicates = dupGroups.size;

  return NextResponse.json({ payeesWithNoRule, conflictingRules, unresolvedDuplicates });
}
