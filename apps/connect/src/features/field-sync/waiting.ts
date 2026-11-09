import type { OutboxItem } from '@/features/expenses/outbox';

import type { SyncItem } from './queue';

/** The screen where waiting work lives, so the tour manager can go and look at it. */
export type WaitingPlace = 'headcount' | 'announcements' | 'expenses';

const PLACES: readonly WaitingPlace[] = ['headcount', 'announcements', 'expenses'];
const NOUNS: Record<WaitingPlace, [one: string, many: string]> = {
  announcements: ['announcement', 'announcements'],
  expenses: ['expense', 'expenses'],
  headcount: ['headcount', 'headcounts'],
};

export interface Waiting {
  /** Saved on this phone and not yet with the office. */
  pending: number;
  /** The screen to open: where the refused items are, or else where the waiting ones are. */
  place: WaitingPlace | null;
  /** True when the counted items all live on that one screen. */
  single: boolean;
  /** Refused by the office and waiting for the tour manager to look. */
  stuck: number;
}

type SyncLike = Pick<SyncItem, 'status'> & { args: { jobCardId: string }; kind: SyncItem['kind'] };
type ExpenseLike = Pick<OutboxItem, 'jobCardId' | 'status'>;

/** One trip's work that the office does not have yet: its counts, announcements and expenses. */
export function waitingWork(sync: readonly SyncLike[], expenses: readonly ExpenseLike[], jobCardId: string | null): Waiting {
  const items = [
    ...sync
      .filter((item) => item.args.jobCardId === jobCardId)
      .map((item) => ({ place: item.kind === 'headcountStop' ? ('headcount' as const) : ('announcements' as const), status: item.status })),
    ...expenses.filter((item) => item.jobCardId === jobCardId).map((item) => ({ place: 'expenses' as const, status: item.status })),
  ];
  const stuck = items.filter((item) => item.status === 'needsAttention');
  const pending = items.filter((item) => item.status === 'pending');
  const counted = stuck.length > 0 ? stuck : pending;
  const places = new Set(counted.map((item) => item.place));
  return {
    pending: pending.length,
    place: PLACES.find((place) => places.has(place)) ?? null,
    single: places.size === 1,
    stuck: stuck.length,
  };
}

/** "2 expenses need a look", "3 waiting to send", or null when nothing is waiting. */
export function waitingLabel(waiting: Waiting) {
  const count = waiting.stuck > 0 ? waiting.stuck : waiting.pending;
  if (count === 0) return null;
  const noun = waiting.single && waiting.place ? `${NOUNS[waiting.place][count === 1 ? 0 : 1]} ` : '';
  if (waiting.stuck > 0) return `${count} ${noun}${count === 1 ? 'needs' : 'need'} a look`;
  return `${count} ${noun}waiting to send`;
}

