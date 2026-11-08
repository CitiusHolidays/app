import type { OutboxItem } from '@/features/expenses/outbox';

import type { SyncItem } from './queue';

export interface Waiting {
  /** Saved on this phone and not yet with the office: counts, announcements and expenses. */
  pending: number;
  /** Refused by the office and waiting for the tour manager to look. */
  stuck: number;
}

/** Everything saved on the phone that the office does not have yet, across both queues. */
export function waitingWork(sync: readonly Pick<SyncItem, 'status'>[], expenses: readonly Pick<OutboxItem, 'status'>[]): Waiting {
  const all = [...sync, ...expenses];
  return {
    pending: all.filter((item) => item.status === 'pending').length,
    stuck: all.filter((item) => item.status === 'needsAttention').length,
  };
}

/** "3 waiting to send", or null when nothing is waiting. */
export function waitingLabel(waiting: Waiting) {
  if (waiting.stuck > 0) return waiting.stuck === 1 ? '1 needs a look' : `${waiting.stuck} need a look`;
  if (waiting.pending > 0) return `${waiting.pending} waiting to send`;
  return null;
}
