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

/**
 * Deletes expired packs; returns the Job Card ids removed. The trips provider runs it at start-up,
 * on a change of trip, and each time the app returns to the foreground. Packs are independent of
 * each other, so they are checked in parallel.
 */
export async function purgeExpiredPacks(store: KeyValueStore, now: number) {
  const removed = await Promise.all(
    (await store.keys(PREFIX)).map(async (packKey) => {
      const pack = await store.getJSON<TripPack>(packKey);
      if (pack && pack.version === TRIP_PACK_VERSION && !isPackExpired(pack, now)) {
        return null;
      }
      await store.delete(packKey);
      return packKey.slice(PREFIX.length);
    })
  );
  return removed.filter((jobCardId) => jobCardId !== null);
}

/**
 * Deletes the packs of trips the server no longer lists for this tour manager (unassigned, or
 * the trip's app pilot was stopped); returns the Job Card ids removed. Only call it with a
 * complete list, or a trip on a page that was not fetched would lose its pack.
 */
export async function prunePacksNotIn(store: KeyValueStore, listedJobCardIds: readonly string[]) {
  const keep = new Set(listedJobCardIds);
  const unlisted = (await store.keys(PREFIX)).filter((packKey) => !keep.has(packKey.slice(PREFIX.length)));
  await Promise.all(unlisted.map((packKey) => store.delete(packKey)));
  return unlisted.map((packKey) => packKey.slice(PREFIX.length));
}
