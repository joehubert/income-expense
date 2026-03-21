// Categories taxonomy API
import { NextRequest, NextResponse } from 'next/server';
import { readCategories, writeCategories } from '@/lib/data';
import type { CategoryEntry } from '@/types';

export async function GET() {
  return NextResponse.json({ categories: readCategories() });
}

// POST — add entry if it doesn't already exist
export async function POST(req: NextRequest) {
  const body = (await req.json()) as CategoryEntry;
  if (!body.category?.trim()) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 });
  }
  const cats = readCategories();
  const exists = cats.some(
    (c) => c.category === body.category && c.subCategory === (body.subCategory ?? '')
  );
  if (!exists) {
    cats.push({ category: body.category.trim(), subCategory: body.subCategory?.trim() ?? '' });
    writeCategories(cats);
  }
  return NextResponse.json({ ok: true });
}
