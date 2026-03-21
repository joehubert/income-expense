// UC-5: Duplicate detection
import type { Transaction } from '@/types';

function compositeKey(t: Transaction): string {
  return `${t.date}|${t.rawPayee}|${t.amount}`;
}

function flagAt<T extends { isDuplicate: boolean }>(arr: T[], idx: number): void {
  if (!arr[idx].isDuplicate) {
    arr[idx] = { ...arr[idx], isDuplicate: true };
  }
}

/**
 * Detect duplicates across existing + incoming transactions using a composite
 * key: date + rawPayee + amount (UC-5).
 *
 * Both the existing record AND the incoming record are flagged isDuplicate=true
 * when their composite keys collide.
 *
 * Returns:
 *   updatedExisting — existing transactions array with any newly-flagged records updated
 *   flaggedIncoming — incoming transactions with duplicates flagged
 *   duplicatesFound — count of incoming transactions flagged as duplicates
 */
export function detectDuplicates(
  existing: Transaction[],
  incoming: Transaction[]
): {
  updatedExisting: Transaction[];
  flaggedIncoming: Transaction[];
  duplicatesFound: number;
} {
  // Build hash map: compositeKey → index in existing array
  const existingMap = new Map<string, number>();
  for (let i = 0; i < existing.length; i++) {
    existingMap.set(compositeKey(existing[i]), i);
  }

  let duplicatesFound = 0;
  const updatedExisting = [...existing];
  const incomingKeys = new Map<string, number>(); // key → index in flaggedIncoming
  const flaggedIncoming: Transaction[] = [];

  for (const t of incoming) {
    const key = compositeKey(t);
    let isDup = false;

    const existingIdx = existingMap.get(key);
    if (existingIdx !== undefined) {
      isDup = true;
      flagAt(updatedExisting, existingIdx);
    }

    const incomingIdx = incomingKeys.get(key);
    if (incomingIdx !== undefined) {
      isDup = true;
      flagAt(flaggedIncoming, incomingIdx);
    }

    if (isDup) duplicatesFound++;
    flaggedIncoming.push(isDup ? { ...t, isDuplicate: true } : t);
    incomingKeys.set(key, flaggedIncoming.length - 1);
  }

  return { updatedExisting, flaggedIncoming, duplicatesFound };
}
