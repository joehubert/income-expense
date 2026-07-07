// UC-3B: Live rule match preview — evaluates draft conditions against
// existing transactions without saving anything.
import { NextRequest, NextResponse } from 'next/server';
import { readTransactions } from '@/lib/data';
import { matchesRule } from '@/lib/rules';
import type { Rule } from '@/types';

interface PreviewRequest {
  account: string | null;
  payeePattern: string | null;
  payeeMatchType: Rule['payeeMatchType'];
  amountMin: number | null;
  amountMax: number | null;
}

export interface PreviewResponse {
  count: number;
  payeeCount: number;
  samplePayees: { rawPayee: string; count: number }[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as PreviewRequest;

  const rule: Rule = {
    id: '',
    description: null,
    account: body.account ?? null,
    payeePattern: body.payeePattern ?? null,
    payeeMatchType: body.payeeMatchType ?? 'substring',
    amountMin: body.amountMin ?? null,
    amountMax: body.amountMax ?? null,
    normalizedPayee: null,
    category: null,
    subCategory: null,
    isIgnored: null,
    createdAt: '',
    updatedAt: '',
  };

  const hasCondition =
    rule.account !== null ||
    rule.payeePattern !== null ||
    rule.amountMin !== null ||
    rule.amountMax !== null;
  if (!hasCondition) {
    return NextResponse.json({ count: 0, payeeCount: 0, samplePayees: [] } satisfies PreviewResponse);
  }

  const transactions = readTransactions().filter((t) => !t.isDiscarded);
  const payees = new Map<string, number>();
  let count = 0;
  for (const t of transactions) {
    if (matchesRule(rule, t)) {
      count++;
      payees.set(t.rawPayee, (payees.get(t.rawPayee) ?? 0) + 1);
    }
  }

  const samplePayees = [...payees.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rawPayee, n]) => ({ rawPayee, count: n }));

  return NextResponse.json({ count, payeeCount: payees.size, samplePayees } satisfies PreviewResponse);
}
