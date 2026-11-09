import type { RosterEntry, TripPack } from '@/features/trip-pack/trip-pack';

export type Show = 'all' | 'missing';

/** What the headcount list shows: one batch or everyone, and everyone or only who is not marked. */
export interface HeadcountFilter {
  batchId: string | null;
  show: Show;
}

export const EVERYONE: HeadcountFilter = { batchId: null, show: 'all' };

export interface HeadcountView {
  /** The batch the filter names, or null for everyone (also when the pack no longer has that batch). */
  batch: TripPack['batches'][number] | null;
  /** Why the list is empty, in words for the tour manager; null when it has rows. */
  empty: { good: boolean; text: string } | null;
  people: RosterEntry[];
}

/**
 * The travellers the list shows, and the words for an empty list. `held` keeps a row that was just
 * marked in "Not marked" for a moment, so it confirms itself where the finger is before it leaves.
 */
export function viewRoster(
  pack: Pick<TripPack, 'batches' | 'roster'>,
  filter: HeadcountFilter,
  present: ReadonlySet<string>,
  held: ReadonlySet<string> = new Set()
): HeadcountView {
  const batch = pack.batches.find((candidate) => candidate.id === filter.batchId) ?? null;
  const people = pack.roster.filter(
    (entry) =>
      entry.travelling &&
      (!batch || entry.batchId === batch.id) &&
      (filter.show === 'all' || !present.has(entry.id) || held.has(entry.id))
  );
  return { batch, empty: people.length > 0 ? null : emptyCopy(filter.show, batch), people };
}

function emptyCopy(show: Show, batch: HeadcountView['batch']): NonNullable<HeadcountView['empty']> {
  if (show === 'missing') {
    return { good: true, text: batch ? `Everyone in ${batch.label} is marked.` : 'Everyone here is marked.' };
  }
  return { good: false, text: batch ? `Nobody in ${batch.label} is travelling.` : 'Nobody on this trip is travelling.' };
}
