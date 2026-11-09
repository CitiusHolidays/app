import type { FieldPush, SyncItem } from './queue';

/** Test helpers: one queued item moved to each state, as the queue itself would leave it. */

/** The push alone, without its queue state. */
export const pushOnly = (item: SyncItem): FieldPush =>
  item.kind === 'headcountStop' ? { args: item.args, kind: item.kind } : { args: item.args, kind: item.kind };

export const syncedAt = (item: SyncItem, at: number, ignoredTravellerIds = 0): SyncItem => ({
  ...pushOnly(item),
  key: item.key,
  landed: { at, ignoredTravellerIds, newerOnServer: false },
  staffId: item.staffId,
  status: 'synced',
  updatedAt: at,
});

export const refusedWith = (item: SyncItem, problem: string): SyncItem => ({
  ...pushOnly(item),
  key: item.key,
  problem,
  staffId: item.staffId,
  status: 'needsAttention',
  updatedAt: item.updatedAt,
});
