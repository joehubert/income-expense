# Personal Finance Categorization App — Requirements Specification

## Instructions for Claude Code

This document is the authoritative product specification for this application. When using it:

- **Treat this document as the source of truth.** Do not deviate from the data models, use case flows, or business rules defined here without explicitly flagging the deviation and asking for confirmation.
- **Ask before filling gaps.** If a situation arises that this document does not address, stop and ask rather than making assumptions.
- **Do not gold-plate.** This is a personal-use application. Prefer simple, working implementations over clever or enterprise-grade ones. Section 6 lists what is explicitly out of scope.
- **Reference use case IDs.** When implementing a feature, reference the corresponding UC identifier (e.g. UC-3B) in your comments and commit messages so the code stays traceable to this spec.
- **Data access isolation.** All JSON file reads and writes must go through `lib/data/`. No page or component may read or write data files directly.

---

## Table of Contents

1. [Purpose & Technical Stack](#1-purpose--technical-stack)
2. [Data Model](#2-data-model)
3. [Application Navigation](#3-application-navigation)
4. [Use Cases](#4-use-cases)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Out of Scope for v1](#6-out-of-scope-for-v1)

---

## 1. Purpose & Technical Stack

This document is the authoritative specification for a personal-use financial transaction categorization application. All design decisions, data models, use cases, and business rules are captured here. Where the specification is silent, prefer simplicity over sophistication.

### 1.1 Goals

- Import CSV transaction exports from Empower.com and AmericanExpress.com
- Automatically categorize transactions via a user-defined rules engine
- Provide reporting and trend analysis across categories and time
- Run entirely on a single local machine with no external services or authentication

### 1.2 Technical Stack

| Concern | Technology |
|---|---|
| Framework | Next.js (App Router) with TypeScript |
| UI Library | React 18+ |
| Styling | Tailwind CSS |
| Charting | Recharts |
| Data Persistence | Local JSON files via Next.js API Routes (no database) |
| Package Manager | npm |
| Runtime | Node.js — local machine only (`localhost:3000`) |
| Authentication | None — single user, local deployment |

### 1.3 Data Files

All application state is stored in JSON files in a `/data` directory at the project root. This directory must be excluded from version control (`.gitignore`) and created automatically on first run if absent.

| File | Contents |
|---|---|
| `transactions.json` | All imported transaction records |
| `rules.json` | All categorization and ignore rules |
| `column-mappings.json` | Saved CSV column mappings keyed by column header fingerprint |
| `categories.json` | User-defined category and sub-category taxonomy |

### 1.4 Project Structure

```
app/                  # Next.js App Router routes and page components
components/           # Shared React components
lib/
  data/               # ALL JSON file I/O — no other layer may touch data files
  rules/              # Rule engine: matching, specificity, conflict detection
  csv/                # CSV parsing and column mapping logic
  duplicates/         # Duplicate detection algorithm
types/                # TypeScript interfaces matching Section 2 data model exactly
data/                 # JSON data files (git-ignored, auto-created on first run)
```

---

## 2. Data Model

### 2.1 Transaction

```typescript
interface Transaction {
  id: string;                  // UUID via crypto.randomUUID()
  date: string;                // YYYY-MM-DD
  amount: number;              // Negative = expense, positive = income
  isIncome: boolean;           // Derived: amount > 0
  account: string;             // User-assigned account name at import time
  source: string;              // Import filename — records provenance
  rawPayee: string;            // Original unmodified payee string from CSV
  normalizedPayee: string | null;  // Set by rule or manual edit
  category: string | null;     // Set by rule or manual edit
  subCategory: string | null;  // Set by rule or manual edit
  isIgnored: boolean;          // Excluded from all analysis when true
  isDuplicate: boolean;        // Flagged by duplicate detection
  isManuallyOverridden: boolean; // Set when user edits fields directly; protects from rule re-application
  isDiscarded: boolean;        // Soft-deleted duplicate; excluded from all views
  importedAt: string;          // ISO 8601 timestamp
  notes: string | null;        // Optional free-text user note
}
```

### 2.2 Rule

A rule is a set of optional match conditions plus actions to apply when all conditions are satisfied.

```typescript
interface Rule {
  id: string;                  // UUID
  description: string | null;  // Optional human-readable label

  // --- Match Conditions (at least one required) ---
  account: string | null;                        // Exact match. Null = any account
  payeePattern: string | null;                   // Null = any payee
  payeeMatchType: 'substring' | 'exact' | 'regex';
  amountMin: number | null;                      // Inclusive lower bound. Null = none
  amountMax: number | null;                      // Inclusive upper bound. Null = none

  // --- Actions ---
  normalizedPayee: string | null;
  category: string | null;
  subCategory: string | null;
  isIgnored: boolean | null;   // Null = no change to isIgnored

  // --- Metadata ---
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}
```

### 2.3 Rule Specificity

When multiple rules match a single transaction, the most specific rule wins. Specificity is determined by the number and combination of conditions set:

| Priority | Conditions Present |
|---|---|
| 1 (highest) | Account + Payee + Amount range |
| 2 | Account + Payee |
| 3 | Payee + Amount range |
| 4 | Account + Amount range |
| 5 | Payee only |
| 6 | Account only |
| 7 (lowest) | Amount range only |

If two rules share identical specificity and overlapping match conditions but produce different actions, they are a **conflict**. The system surfaces conflicts in the UI and does not silently pick one.

### 2.4 Column Mapping

```typescript
interface ColumnMapping {
  id: string;           // Fingerprint of sorted CSV column headers (lookup key)
  accountName: string;  // Default account name for this mapping
  mappings: {           // Application field → CSV column header name
    date: string;
    payee: string;
    amount: string;
    account?: string;   // Optional: if present in CSV
  };
  createdAt: string;    // ISO 8601
}
```

### 2.5 Category Taxonomy

```typescript
// categories.json contains an array of these
interface CategoryEntry {
  category: string;
  subCategory: string;
}
```

The app starts with an empty list. The user builds the taxonomy organically through the rules and transaction editing workflows. Category/subCategory values used in rules and transactions must reference entries in this list, or be created inline (which adds them to `categories.json` immediately).

---

## 3. Application Navigation

The application uses a persistent left-sidebar navigation. All top-level sections are always accessible. The sidebar shows badge counts for actionable items.

| Nav Item | Route | Badge |
|---|---|---|
| Import | `/import` | — |
| Transactions | `/transactions` | — |
| Payee Summary | `/payees` | Count of payees with no rule |
| Rules | `/rules` | Count of conflicting rules |
| Ignored | `/ignored` | — |
| Duplicates | `/duplicates` | Count of unresolved duplicate groups |
| Reports | `/reports` | — |

---

## 4. Use Cases

---

### UC-1: Import CSV File

**Actor:** User

**Preconditions:** User has a CSV file exported from Empower.com or AmericanExpress.com.

**Main Flow:**

1. User navigates to `/import` and clicks **Import CSV**.
2. System opens a file picker restricted to `.csv` files.
3. User selects a file. System reads the file and extracts the header row.
4. System computes a fingerprint from the sorted column headers and looks up `column-mappings.json`.
5. **If a saved mapping exists:** System pre-fills the column mapping UI with saved values and shows a "Using saved mapping" notice. User may adjust.
6. **If no saved mapping exists:** System displays a mapping UI. For each required field (Date, Payee, Amount) and optional field (Account), user selects the corresponding CSV column from a dropdown of the file's actual header names.
7. User assigns an **Account Name** for this import (free-text, e.g. "Chase Checking"). System suggests the previously used name for this mapping fingerprint if one exists.
8. User clicks **Preview**. System parses up to 10 rows and displays them in a preview table showing mapped field values.
9. User confirms import. System processes all rows:
   - Parses date, amount, rawPayee from mapped columns
   - Sets `isIncome = (amount > 0)`
   - Generates a UUID for each transaction
   - Applies all active rules in specificity order (see UC-3D)
   - Runs duplicate detection (see UC-5)
   - Appends valid transactions to `transactions.json`
10. System saves the column mapping to `column-mappings.json` keyed by header fingerprint.
11. System displays an import summary: rows imported, rules applied, duplicates flagged, rows skipped (parse errors).

**Alternate Flow — Parse Errors:** If a row cannot be parsed (invalid date, non-numeric amount), it is skipped and listed in the import summary error log. It is not added to `transactions.json`.

**Business Rules:**

- Required mapped fields: Date, Payee, Amount. Account is optional in the CSV but the user must supply an Account Name manually.
- Amount parsing: strip currency symbols (`$`, commas) before conversion to float.
- Date parsing: attempt ISO 8601 first, then `MM/DD/YYYY`, then `M/D/YYYY`.

---

### UC-2: View & Edit Transactions

**Actor:** User

**Main Flow:**

1. User navigates to `/transactions`.
2. System displays a paginated, sortable table of all non-ignored, non-discarded transactions. Default sort: date descending.
3. User may filter by: date range, account, category, sub-category, `isIncome`, and free-text search (matches `rawPayee` or `normalizedPayee`).
4. Each row shows: date, account, rawPayee, normalizedPayee, category, subCategory, amount, isIncome badge, and a pencil icon if `isManuallyOverridden = true`.
5. User clicks a row to open an **edit drawer** (slide-in side panel). The drawer allows editing: `normalizedPayee`, `category`, `subCategory`, `notes`.
6. Saving the drawer sets `isManuallyOverridden = true` on that transaction and persists to `transactions.json`.

**Business Rules:**

- Transactions with `isManuallyOverridden = true` display a visual indicator in the table row.
- Manually overridden transactions are skipped when rules are bulk-applied, unless Force Apply is used (see UC-3D).
- `isIgnored = true` transactions are not shown here — only at `/ignored`.
- `isDiscarded = true` transactions are not shown anywhere in the UI.

---

### UC-3: Create & Manage Rules

**Actor:** User

**Navigation Entry Points:**
- Top-level nav: `/rules`
- From `/payees`: clicking **Create Rule** on any payee row opens the Rule Editor pre-filled with that payee's `rawPayee` as a substring match condition

---

#### UC-3A: Rules List View (`/rules`)

1. System displays a table of all rules. Each row shows: conditions summary, actions summary, matched transaction count, conflict badge if applicable.
2. Filter bar: **All** / **Conflicting only**.
3. Clicking a rule row opens the **Rule Detail Panel** (UC-3C).
4. **New Rule** button opens the Rule Editor (UC-3B).
5. **Delete** on a rule shows a confirmation dialog indicating how many transactions will lose their categorization.

---

#### UC-3B: Rule Editor (create or edit)

1. Editor form contains:
   - **Conditions:** Account (dropdown of known accounts, or blank), Payee Pattern (text input), Payee Match Type (substring / exact / regex), Amount Min (numeric, optional), Amount Max (numeric, optional)
   - **Actions:** Normalized Payee (text), Category (dropdown + inline create), Sub-Category (dropdown filtered to selected category + inline create), Is Ignored (toggle)
   - **Description** (optional label)
2. System requires at least one condition to be set before the form can be saved.
3. On save, system checks for conflicts: another rule with identical specificity and overlapping conditions producing different actions. If found, a warning is shown listing conflicting rules — the save is still allowed.
4. After save, system immediately applies the new rule to all existing transactions that match it and have `isManuallyOverridden = false`.

---

#### UC-3C: Rule Detail Panel

Opened by clicking a rule row. Displayed as a right-side panel alongside the list.

1. Panel header: human-readable summary of the rule's conditions and actions.
2. Panel body: table of all transactions currently matched by this rule.
   - Columns: date, account, rawPayee, normalizedPayee, category, subCategory, amount, override indicator
3. Each transaction row has an **inline Edit** action: mini-form to edit `normalizedPayee`, `category`, `subCategory`. Saving sets `isManuallyOverridden = true`.
4. Each transaction row has a **View in Transactions** link that navigates to `/transactions` with that transaction's ID pre-selected and the edit drawer open.
5. Panel summary bar: total transaction count, total amount, date range covered.
6. **Apply to Uncategorized** and **Force Apply** buttons are available in this panel (see UC-3D).

---

#### UC-3D: Applying Rules

| Mode | Trigger | Behavior |
|---|---|---|
| On Import (automatic) | Every import | All rules run against newly imported transactions. New transactions never have `isManuallyOverridden = true`. |
| Apply to Uncategorized | Button on `/rules` or Rule Detail Panel | Runs rules only on transactions where `category` is null and `isManuallyOverridden = false`. |
| Force Apply | Button on `/rules` or Rule Detail Panel | Runs rules on ALL matching transactions regardless of `isManuallyOverridden`. Requires confirmation dialog showing count of transactions that will be overwritten. |

**Business Rules:**

- Rule specificity order is defined in Section 2.3. Most specific matching rule wins.
- `isIgnored = true` set by a rule takes precedence over any categorization action in that same rule.
- Category and subCategory values must exist in `categories.json` or be created inline (which persists them immediately).

---

### UC-4: Payee Summary

**Actor:** User

**Main Flow:**

1. User navigates to `/payees`.
2. System displays a table grouped by unique `rawPayee` values. Each row shows: rawPayee, transaction count, total amount, amount range (min/max), matched rule name (if any), **Unmatched** badge if no rule exists.
3. Default view shows only unmatched payees. User can toggle to show all.
4. User can sort by: payee name, count, total amount.
5. Each row has a **Create Rule** button — opens Rule Editor (UC-3B) pre-filled with that payee as a substring match condition.
6. Each row has a **View Transactions** link — navigates to `/transactions` filtered by that `rawPayee`.
7. Sidebar badge shows count of payees with no rule assigned.

**Business Rules:**

- Grouping is by exact `rawPayee` string. No fuzzy matching is applied automatically.
- Ignored and discarded transactions are excluded from payee summary totals.

---

### UC-5: Duplicate Detection

**Actor:** System (automatic) and User (resolution)

#### Detection Algorithm

Duplicates are identified by a composite key: **date + rawPayee + amount** (all three must match exactly). The algorithm is designed to remain efficient as the dataset grows.

1. At import time, before appending new transactions, the system builds an **in-memory hash map** of existing transactions keyed by the composite key.
2. Each incoming transaction is looked up in the hash map. If a match is found, both the existing and incoming transaction are flagged: `isDuplicate = true`.
3. All flagged transactions are written to `transactions.json` with `isDuplicate = true`.
4. Duplicate detection can also be triggered on-demand from `/duplicates` via a **Re-scan** button, which rebuilds the hash map from the full dataset.

#### Duplicate Review Flow (`/duplicates`)

1. System displays grouped sets of transactions sharing the same composite key.
2. Each group shows all matching transactions with: date, rawPayee, amount, account, source filename, importedAt.
3. For each group the user can:
   - **Keep one, discard others:** user selects the record to keep; others are set to `isDiscarded = true` and permanently excluded from all views and analysis.
   - **Mark as Not Duplicate:** sets `isDuplicate = false` on all transactions in the group. They will not be re-flagged unless the user triggers a re-scan.
4. Sidebar badge shows count of unresolved duplicate groups.

**Business Rules:**

- `isDuplicate = true` does not automatically exclude a transaction from analysis. The user must resolve it. Unresolved duplicates appear with a warning indicator in the Transactions view.
- Duplicates within the same import file are treated identically to duplicates across separate imports.

---

### UC-6: Ignored Transactions

**Actor:** User

**Main Flow:**

1. User navigates to `/ignored`.
2. System displays a table of all transactions where `isIgnored = true`. Columns: date, account, rawPayee, amount, reason (rule name that set `isIgnored`, or "Manual").
3. Summary bar: total count, total dollar amount of ignored transactions.
4. User can **un-ignore** a transaction: sets `isIgnored = false` and `isManuallyOverridden = true` (preventing the rule from immediately re-ignoring it).
5. User can bulk un-ignore via checkboxes.

**Business Rules:**

- Ignored transactions are excluded from all charts, report totals, and the payee summary.
- Ignored transactions do not appear in `/transactions` — only at `/ignored`.

---

### UC-7: Reports

**Actor:** User

#### Shared Controls

All report views share a date range control at the top with these presets:

- **YTD** — January 1 of the current year through today
- **Custom Range** — date pickers for start and end date

All report views exclude: `isIgnored = true` transactions and `isDiscarded = true` transactions.

---

#### UC-7A: Expense Summary

1. User navigates to `/reports` and selects **Expense Summary**.
2. System displays a pie chart of total spend by category for the selected date range. Expense transactions only (`isIncome = false`).
3. Below the pie chart: a companion table listing each category with total amount and percentage of total spend.
4. Each category row is **expandable inline** to reveal sub-category breakdown (amount + percentage of category total).
5. Each sub-category row is **expandable inline** to reveal normalizedPayee breakdown (amount + transaction count).
6. Transactions with no category are grouped under **"Uncategorized"**.

---

#### UC-7B: Income vs. Expense Trend

1. User navigates to `/reports` and selects **Income vs. Expense**.
2. System displays a grouped column chart: for each month in the selected date range, one column for total income and one column for total expense.
3. Below the chart: a summary table with columns: Month, Total Income, Total Expense, Net.

**Business Rules:**

- All report calculations use the absolute value of `amount`. The `isIncome` flag determines the bucket (income vs. expense).
- The `/reports` route must be structured to support additional report types as nav items or tabs without requiring structural refactoring. New reports will be defined incrementally.

---

## 5. Non-Functional Requirements

### 5.1 Performance

- All read operations must complete in under 500ms for a dataset of up to 5,000 transactions.
- Duplicate detection must use an in-memory hash map — do not perform row-by-row scans against the full file.
- JSON file reads should be cached in memory per request where possible; avoid redundant disk reads within a single operation.

### 5.2 Data Integrity

- All writes to JSON files must be **atomic**: write to a `.tmp` file first, then rename to the target filename. This prevents data corruption from partial writes.
- On startup, if a JSON data file is missing, create it with an empty default structure. Never crash on a missing file.
- UUIDs must be generated using `crypto.randomUUID()` — not `Math.random()`.

### 5.3 UI / UX

- All tables must support sorting by column header click.
- All destructive actions (delete rule, force apply, discard duplicate) must show a **confirmation dialog** with a plain-language description of what will happen and how many records are affected.
- Every view must handle **empty state** gracefully with an instructional message (e.g. "No transactions yet — import a CSV to get started.").
- **Loading** and **error** states must be handled explicitly on every data-fetching component.

---

## 6. Out of Scope for v1

The following items must **not** be implemented unless explicitly requested:

- Export to CSV or any format other than raw JSON backup
- Multi-device or cloud sync
- Authentication or user management
- OFX / QFX file import (CSV only)
- Split transactions (one transaction, multiple categories)
- Audit logging of field changes
- Balance or net worth tracking
- Dark mode
- Mobile-optimized layout (desktop browser is sufficient)
