import { useEffect, useState } from 'react';

import { loadPack } from '@/features/trip-pack/pack-store';
import type { TripPack } from '@/features/trip-pack/trip-pack';
import { type TripSummary, useTrips } from '@/features/trips/trips-context';
import { useAppStore } from '@/lib/app-store';
import { logEvent } from '@/lib/safe-log';
import type { LiveStore } from '@/lib/storage/live-store';
import type { KeyValueStore } from '@/lib/storage/kv';

import { type Announcement, ANNOUNCEMENTS_PREFIX } from './announcements';
import { useAnnouncements } from './use-announcements';

export type AnnouncementDetail =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | {
      announcement: Announcement;
      kind: 'found';
      /** A recipient's name, or words for why the phone does not have it. */
      nameOf: (travellerId: string) => string;
      toggleAck: (travellerId: string) => void;
      /** "J-1234 Bali", for the shared text. */
      tripLabel: string;
    };

/**
 * Finds the trip whose log on this phone holds the announcement. The in-memory copy is read first:
 * an announcement shared a moment ago may not be on disk yet.
 */
async function findAnnouncementTrip(store: KeyValueStore, live: LiveStore, id: string) {
  for (const key of await store.keys(ANNOUNCEMENTS_PREFIX)) {
    const entry = live.snapshot(key);
    const log: unknown = entry ? entry.value : await store.getJSON(key);
    // Only the id is read, so only the id is checked: a saved log is never trusted further here.
    if (Array.isArray(log) && log.some((item: unknown) => typeof item === 'object' && item !== null && 'id' in item && item.id === id)) {
      return key.slice(ANNOUNCEMENTS_PREFIX.length);
    }
  }
  return null;
}

/**
 * One announcement and its seen-by checklist, from whichever trip it was shared on: the link names
 * the trip, and an older link without it is found by searching every trip's log on this phone.
 */
export function useAnnouncementDetail(id: string, tripHint: string | null): AnnouncementDetail {
  const { live, store } = useAppStore();
  const { pack, selected, trips } = useTrips();
  /** The result of searching every trip's log for this id: the trip that has it, or null for none. */
  const [search, setSearch] = useState<{ id: string; jobCardId: string | null } | null>(null);
  const searched = search?.id === id ? search : null;
  const jobCardId = searched?.jobCardId ?? tripHint ?? selected?.id ?? null;
  const { loaded, log, toggleAck } = useAnnouncements(jobCardId);
  const announcement = log.find((item) => item.id === id);
  const needsSearch = (jobCardId === null || loaded) && !announcement && !searched;

  useEffect(() => {
    if (!needsSearch) return;
    let active = true;
    findAnnouncementTrip(store, live, id)
      .catch((error: unknown) => {
        logEvent('announcement.lookup-failed', error);
        return null;
      })
      .then((found) => {
        if (active) setSearch({ id, jobCardId: found });
      });
    return () => {
      active = false;
    };
  }, [id, live, needsSearch, store]);

  const tripPack = useTripPack(announcement?.jobCardId ?? null, pack);

  if (!announcement) {
    // Missing only once every trip's log was searched and the trip it pointed to is read.
    return searched && (jobCardId === null || loaded) ? { kind: 'missing' } : { kind: 'loading' };
  }
  return {
    announcement,
    kind: 'found',
    nameOf: namesFrom(tripPack),
    toggleAck: (travellerId) => toggleAck(announcement.id, travellerId),
    tripLabel: labelFor(announcement.jobCardId, trips, tripPack),
  };
}

/** Looks up a recipient's name in the trip's pack, or says why the phone does not have it. */
function namesFrom(tripPack: TripPack | null) {
  const names = new Map((tripPack?.roster ?? []).map((entry) => [entry.id, entry.name]));
  const fallback = tripPack ? 'Traveller no longer on the roster' : 'Name not on this phone';
  return (travellerId: string) => names.get(travellerId) ?? fallback;
}

/** "J-1234 Bali": from the trips list when the trip is there, otherwise from its saved pack. */
function labelFor(jobCardId: string, trips: readonly TripSummary[], tripPack: TripPack | null) {
  const source = trips.find((candidate) => candidate.id === jobCardId) ?? tripPack;
  return source ? `${source.jobCode} ${source.destination}`.trim() : '';
}

/** The saved pack for a trip: the selected one from memory, any other read from the phone. */
function useTripPack(jobCardId: string | null, selectedPack: TripPack | null) {
  const { store } = useAppStore();
  const [other, setOther] = useState<TripPack | null>(null);
  const needsRead = jobCardId !== null && selectedPack?.jobCardId !== jobCardId;
  useEffect(() => {
    if (!needsRead || !jobCardId) return;
    let active = true;
    loadPack(store, jobCardId, Date.now())
      .catch((error: unknown) => {
        logEvent('announcement.pack-read-failed', error);
        return null;
      })
      .then((read) => {
        if (active) setOther(read);
      });
    return () => {
      active = false;
    };
  }, [jobCardId, needsRead, store]);
  if (selectedPack?.jobCardId === jobCardId) return selectedPack;
  return other?.jobCardId === jobCardId ? other : null;
}
