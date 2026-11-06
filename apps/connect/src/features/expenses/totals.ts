import type { ExpenseRow } from '@citius/backend';

import type { OutboxItem } from './outbox';

/** One expense counted toward the trip's spend, wherever it is (server or this phone). */
export interface SpendEntry {
  amount: number;
  category: string;
  currency: string;
}

export interface CurrencyTotal {
  count: number;
  currency: string;
  total: number;
}

export interface CategoryShare {
  category: string;
  /** 0..1 of the currency's total. */
  share: number;
  total: number;
}

/**
 * The expenses that make up the trip's spend, each counted once. Server rows win; a queued item
 * the server already holds (it has the item's expense id, or it is done while the server list is
 * loaded) is not counted again. Without a server list, everything on this phone counts.
 */
export function spendEntries(outbox: OutboxItem[], server: ExpenseRow[] | null): SpendEntry[] {
  const entries: SpendEntry[] = (server ?? []).map((row) => ({
    amount: row.amount,
    category: row.category,
    currency: row.currency,
  }));
  const serverIds = new Set((server ?? []).map((row) => row.id));
  for (const item of outbox) {
    if (server && (item.status === 'done' || (item.expenseId && serverIds.has(item.expenseId)))) continue;
    entries.push({ amount: item.draft.amount, category: item.draft.category, currency: item.draft.currency });
  }
  return entries.filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0);
}

/** Sums in minor units so 0.1 + 0.2 stays 0.3. */
const toMinor = (amount: number) => Math.round(amount * 100);

/** The spend per currency, the most-used currency first. Currencies are never added together. */
export function totalsByCurrency(entries: SpendEntry[]): CurrencyTotal[] {
  const totals = new Map<string, { count: number; minor: number }>();
  for (const entry of entries) {
    const current = totals.get(entry.currency) ?? { count: 0, minor: 0 };
    totals.set(entry.currency, { count: current.count + 1, minor: current.minor + toMinor(entry.amount) });
  }
  return [...totals.entries()]
    .map(([currency, value]) => ({ count: value.count, currency, total: value.minor / 100 }))
    .sort((left, right) => right.count - left.count || right.total - left.total || left.currency.localeCompare(right.currency));
}

/** How one currency's spend splits across categories, largest first. */
export function categorySplit(entries: SpendEntry[], currency: string): CategoryShare[] {
  const byCategory = new Map<string, number>();
  for (const entry of entries) {
    if (entry.currency !== currency) continue;
    const category = entry.category.trim() || 'Other';
    byCategory.set(category, (byCategory.get(category) ?? 0) + toMinor(entry.amount));
  }
  const sum = [...byCategory.values()].reduce((total, minor) => total + minor, 0);
  if (sum === 0) return [];
  return [...byCategory.entries()]
    .map(([category, minor]) => ({ category, share: minor / sum, total: minor / 100 }))
    .sort((left, right) => right.total - left.total || left.category.localeCompare(right.category));
}

/** The figure without its currency sign, with the currency's own decimals ("1,250.50", "¥ 1,250"). */
export function formatAmount(amount: number, currency: string, locale?: string) {
  let digits = 2;
  try {
    digits = new Intl.NumberFormat(locale, { currency, style: 'currency' }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount);
}
