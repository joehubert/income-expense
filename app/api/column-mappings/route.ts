// UC-1: Column mapping persistence API
import { NextRequest, NextResponse } from 'next/server';
import { readColumnMappings, writeColumnMappings } from '@/lib/data';
import type { ColumnMapping } from '@/types';

// GET /api/column-mappings?fingerprint=xxx
export async function GET(req: NextRequest) {
  const fingerprint = req.nextUrl.searchParams.get('fingerprint');
  if (!fingerprint) {
    return NextResponse.json({ error: 'fingerprint query param required' }, { status: 400 });
  }
  const mappings = readColumnMappings();
  const found = mappings.find((m) => m.id === fingerprint) ?? null;
  return NextResponse.json({ mapping: found });
}

// POST /api/column-mappings — upsert by id (fingerprint)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as ColumnMapping;
  if (!body.id || !body.mappings || !body.accountName) {
    return NextResponse.json({ error: 'Invalid mapping payload' }, { status: 400 });
  }
  const mappings = readColumnMappings();
  const idx = mappings.findIndex((m) => m.id === body.id);
  if (idx >= 0) {
    mappings[idx] = body;
  } else {
    mappings.push(body);
  }
  writeColumnMappings(mappings);
  return NextResponse.json({ ok: true });
}
