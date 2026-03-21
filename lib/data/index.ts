import fs from 'fs';
import path from 'path';
import type { Transaction, Rule, ColumnMapping, CategoryEntry } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');

const FILES = {
  transactions: path.join(DATA_DIR, 'transactions.json'),
  rules: path.join(DATA_DIR, 'rules.json'),
  columnMappings: path.join(DATA_DIR, 'column-mappings.json'),
  categories: path.join(DATA_DIR, 'categories.json'),
} as const;

// Ensure the data directory and all default files exist
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const defaults: Record<string, string> = {
    [FILES.transactions]: '[]',
    [FILES.rules]: '[]',
    [FILES.columnMappings]: '[]',
    [FILES.categories]: '[]',
  };
  for (const [filePath, defaultContent] of Object.entries(defaults)) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, defaultContent, 'utf8');
    }
  }
}

function readJson<T>(filePath: string): T {
  ensureDataDir();
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

// Atomic write: write to .tmp then rename
function writeJson<T>(filePath: string, data: T): void {
  ensureDataDir();
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

// --- Transactions ---
export function readTransactions(): Transaction[] {
  return readJson<Transaction[]>(FILES.transactions);
}
export function writeTransactions(transactions: Transaction[]): void {
  writeJson(FILES.transactions, transactions);
}

// --- Rules ---
export function readRules(): Rule[] {
  return readJson<Rule[]>(FILES.rules);
}
export function writeRules(rules: Rule[]): void {
  writeJson(FILES.rules, rules);
}

// --- Column Mappings ---
export function readColumnMappings(): ColumnMapping[] {
  return readJson<ColumnMapping[]>(FILES.columnMappings);
}
export function writeColumnMappings(mappings: ColumnMapping[]): void {
  writeJson(FILES.columnMappings, mappings);
}

// --- Categories ---
export function readCategories(): CategoryEntry[] {
  return readJson<CategoryEntry[]>(FILES.categories);
}
export function writeCategories(categories: CategoryEntry[]): void {
  writeJson(FILES.categories, categories);
}
