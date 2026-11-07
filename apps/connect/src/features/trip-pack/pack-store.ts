import type { KeyValueStore } from '@/lib/storage/kv';

import { isPackExpired, TRIP_PACK_VERSION, type TripPack } from './trip-pack';

const PREFIX = 'pack:';
const key = (jobCardId: string) => `${PREFIX}${jobCardId}`;

export async function savePack(store: KeyValueStore, pack: TripPack) {
  await store.setJSON(key(pack.jobCardId), pack);
}

export async function deletePack(store: KeyValueStore, jobCardId: string) {
  await store.delete(key(jobCardId));
}

/** Returns the saved pack, or null when there is none, it expired (deleted now) or its format is old. */
export async function loadPack(store: KeyValueStore, jobCardId: string, now: number) {
  const pack = await store.getJSON<TripPack>(key(jobCardId));
  if (!pack || pack.version !== TRIP_PACK_VERSION) {
    return null;
  }
  if (isPackExpired(pack, now)) {
    await store.delete(key(jobCardId));
    return null;
  }
  return pack;
}

/** Deletes expired packs; returns the Job Card ids removed. Run at start-up and on foreground. */
export async function purgeExpiredPacks(store: KeyValueStore, now: number) {
  const removed: string[] = [];
  for (const packKey of await store.keys(PREFIX)) {
    const pack = await store.getJSON<TripPack>(packKey);
    if (!pack || pack.version !== TRIP_PACK_VERSION || isPackExpired(pack, now)) {
      await store.delete(packKey);
      removed.push(packKey.slice(PREFIX.length));
    }
  }
  return removed;
}

/**
 * Deletes the packs of trips the server no longer lists for this tour manager (unassigned, or
 * the trip's app pilot was stopped); returns the Job Card ids removed. Only call it with a
 * complete list, or a trip on a page that was not fetched would lose its pack.
 */
export async function prunePacksNotIn(store: KeyValueStore, listedJobCardIds: readonly string[]) {
  const keep = new Set(listedJobCardIds);
  const removed: string[] = [];
  for (const packKey of await store.keys(PREFIX)) {
    const jobCardId = packKey.slice(PREFIX.length);
    if (!keep.has(jobCardId)) {
      await store.delete(packKey);
      removed.push(jobCardId);
    }
  }
  return removed;
}
