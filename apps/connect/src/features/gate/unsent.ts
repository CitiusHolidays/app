import type { StatusKind } from '@citius/ui';

import type { OutboxItem } from '@/features/expenses/outbox';
import type { SyncItem } from '@/features/field-sync/queue';

/** What this phone holds that the office does not have yet, by kind, and how much of it was refused. */
export interface Unsent {
  announcements: number;
  expenses: number;
  headcounts: number;
  /** Of those, refused by the office and waiting for the tour manager to look. */
  refused: { expenses: number; field: number };
}

export function unsentWork(field: readonly Pick<SyncItem, 'kind' | 'status'>[], expenses: readonly Pick<OutboxItem, 'status'>[]): Unsent {
  const fieldUnsent = field.filter((item) => item.status !== 'synced');
  const expensesUnsent = expenses.filter((item) => item.status !== 'done');
  return {
    announcements: fieldUnsent.filter((item) => item.kind === 'announcement').length,
    expenses: expensesUnsent.length,
    headcounts: fieldUnsent.filter((item) => item.kind === 'headcountStop').length,
    refused: {
      expenses: expensesUnsent.filter((item) => item.status === 'needsAttention').length,
      field: fieldUnsent.filter((item) => item.status === 'needsAttention').length,
    },
  };
}

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** "2 expenses, 1 headcount and 1 announcement": only the kinds there are. */
function listUnsent(unsent: Unsent) {
  const parts = [
    unsent.expenses ? count(unsent.expenses, 'expense', 'expenses') : null,
    unsent.headcounts ? count(unsent.headcounts, 'headcount', 'headcounts') : null,
    unsent.announcements ? count(unsent.announcements, 'announcement', 'announcements') : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '');
}

const total = (unsent: Unsent) => unsent.expenses + unsent.headcounts + unsent.announcements;

/** The sign-out confirmation: names everything that would be lost, not only expenses. */
export function signOutWarning(unsent: Unsent) {
  if (total(unsent) === 0) {
    return 'Signing out deletes the saved trip packs, headcounts and announcements from this phone.';
  }
  const receipts = unsent.expenses ? ', with the receipt photos,' : '';
  return `Not sent to the office yet: ${listUnsent(unsent)}. Signing out deletes ${total(unsent) === 1 ? 'it' : 'them'}${receipts} from this phone.`;
}

/** One status for everything this phone sends to the office: expenses, headcounts and announcements. */
export function syncStatus(unsent: Unsent): { kind: StatusKind; label: string; text: string } {
  const { expenses, field } = unsent.refused;
  if (expenses + field > 0) {
    const where = [
      expenses ? `${count(expenses, 'expense', 'expenses')} on the Expenses tab` : null,
      field ? `${count(field, 'headcount or announcement', 'headcounts or announcements')}` : null,
    ].filter(Boolean);
    return { kind: 'attention', label: 'Needs attention', text: `The office refused ${where.join(' and ')}.` };
  }
  if (total(unsent) > 0) {
    return { kind: 'neutral', label: 'Waiting', text: `Waiting to send: ${listUnsent(unsent)}.` };
  }
  return { kind: 'good', label: 'All sent', text: 'Every expense, headcount and announcement on this phone has reached the office.' };
}
