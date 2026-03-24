// Section 2.1 — Transaction
export interface Transaction {
  id: string;                     // UUID via crypto.randomUUID()
  date: string;                   // YYYY-MM-DD
  amount: number;                 // Negative = expense, positive = income
  isIncome: boolean;              // Derived: amount > 0
  account: string;                // User-assigned account name at import time
  source: string;                 // Import filename — records provenance
  rawPayee: string;               // Original unmodified payee string from CSV
  normalizedPayee: string | null; // Set by rule or manual edit
  category: string | null;        // Set by rule or manual edit
  subCategory: string | null;     // Set by rule or manual edit
  isIgnored: boolean;             // Excluded from all analysis when true
  isDuplicate: boolean;           // Flagged by duplicate detection
  isManuallyOverridden: boolean;  // Set when user edits fields directly; protects from rule re-application
  isDiscarded: boolean;           // Soft-deleted duplicate; excluded from all views
  importedAt: string;             // ISO 8601 timestamp
  notes: string | null;           // Optional free-text user note
}

// Section 2.2 — Rule
export interface Rule {
  id: string;                   // UUID
  description: string | null;  // Optional human-readable label

  // Match Conditions (at least one required)
  account: string | null;                         // Exact match. Null = any account
  payeePattern: string | null;                    // Null = any payee
  payeeMatchType: 'substring' | 'exact' | 'regex';
  amountMin: number | null;                       // Inclusive lower bound. Null = none
  amountMax: number | null;                       // Inclusive upper bound. Null = none

  // Actions
  normalizedPayee: string | null;
  category: string | null;
  subCategory: string | null;
  isIgnored: boolean | null;    // Null = no change to isIgnored

  // Metadata
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}

// Section 2.4 — Column Mapping
export interface ColumnMapping {
  id: string;           // Fingerprint of sorted CSV column headers (lookup key)
  accountName: string;  // Default account name for this mapping
  mappings: {           // Application field → CSV column header name
    date: string;
    payee: string;
    amount: string;
    account?: string;   // Optional: if present in CSV
  };
  invertAmounts?: boolean; // True if this CSV stores expenses as positive values
  createdAt: string;    // ISO 8601
}

// Section 2.5 — Category Taxonomy
export interface CategoryEntry {
  category: string;
  subCategory: string;
}
