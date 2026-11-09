import { pushOf, type SyncItem } from './queue';

/** Test helpers: one queued item moved to each state, as the queue itself would leave it. */

export const syncedAt = (item: SyncItem, at: number, ignoredTravellerIds = 0): SyncItem => ({
  ...pushOf(item),
  key: item.key,
  landed: { at, ignoredTravellerIds, newerOnServer: false },
  staffId: item.staffId,
  status: 'synced',
  updatedAt: at,
});

export const refusedWith = (item: SyncItem, problem: string): SyncItem => ({
  ...pushOf(item),
  key: item.key,
  problem,
  staffId: item.staffId,
  status: 'needsAttention',
  updatedAt: item.updatedAt,
});
