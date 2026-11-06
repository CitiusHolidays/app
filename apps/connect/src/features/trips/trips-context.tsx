import { type JobCardRow, type PaginationOpts, staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { useStaffSession } from '@/features/gate/session';
import { deletePack, loadPack, purgeExpiredPacks, savePack } from '@/features/trip-pack/pack-store';
import { buildTripPack, type TripPack } from '@/features/trip-pack/trip-pack';
import { useAppStore, useStoredValue } from '@/lib/app-store';
import { logEvent } from '@/lib/safe-log';
import { useNow } from '@/lib/use-now';

import { collectPages, pickDefaultTrip, sortTrips } from './trips';

export type TripSummary = Pick<
  JobCardRow,
  'clientName' | 'destination' | 'id' | 'jobCode' | 'status' | 'travelBatchCount' | 'travelEndDate' | 'travelStartDate'
>;

interface TripsCache {
  complete: boolean;
  savedAt: number;
  trips: TripSummary[];
}

interface TripsValue {
  /**
   * The trip the tour manager picked on Today, if it is still in their list. Unlike `selected`
   * it is never a default guess, so anything filed against a trip (an expense) uses this.
   */
  chosen: TripSummary | null;
  pack: TripPack | null;
  packLoading: boolean;
  packProblem: string | null;
  refreshPack: () => Promise<void>;
  refreshTrips: () => Promise<void>;
  refreshing: boolean;
  selectTrip: (jobCardId: string) => void;
  selected: TripSummary | null;
  trips: TripSummary[];
  /** False when the server had more pages than the app reads: the list may be missing trips. */
  tripsComplete: boolean;
  tripsLoaded: boolean;
  tripsProblem: string | null;
  tripsSavedAt: number | null;
}

const TripsContext = createContext<TripsValue | null>(null);
const PAGE = 100;
const MAX_PAGES = 10;
/** Packs older than this are refreshed automatically when the device is online. */
const PACK_STALE_MS = 15 * 60 * 1000;

const toSummary = (row: JobCardRow): TripSummary => ({
  clientName: row.clientName,
  destination: row.destination,
  id: row.id,
  jobCode: row.jobCode,
  status: row.status,
  travelBatchCount: row.travelBatchCount,
  travelEndDate: row.travelEndDate,
  travelStartDate: row.travelStartDate,
});

const firstPage = (cursor: string | null): PaginationOpts => ({ cursor, numItems: PAGE });

export function TripsProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { live, store } = useAppStore();
  const { gate, online } = useStaffSession();
  const canReachServer = online && gate.kind === 'staff' && !gate.offline;
  const [cache, setCache, tripsLoaded] = useStoredValue<TripsCache | null>('trips:list', null);
  const [selectedId, setSelectedId] = useStoredValue<string | null>('trips:selected', null);
  const [refreshing, setRefreshing] = useState(false);
  const [tripsProblem, setTripsProblem] = useState<string | null>(null);
  const [packState, setPackState] = useState<{ jobCardId: string | null; loading: boolean; pack: TripPack | null }>({
    jobCardId: null,
    loading: true,
    pack: null,
  });
  const [packProblem, setPackProblem] = useState<string | null>(null);

  const now = useNow();
  const trips = sortTrips(cache?.trips ?? [], now);
  const chosen = trips.find((trip) => trip.id === selectedId) ?? null;
  const selected = chosen ?? pickDefaultTrip(trips, now);

  const refreshTrips = useCallback(async () => {
    if (!canReachServer) {
      return;
    }
    setRefreshing(true);
    // Signing out (or a change of user) wipes the store; a refresh begun before that must not
    // write the previous user's trips back.
    const current = live.fence();
    try {
      const result = await collectPages(
        (cursor) => convex.query(staffApi.listJobCards.ref, { paginationOpts: firstPage(cursor) }),
        MAX_PAGES
      );
      if (!current()) return;
      void setCache({ complete: result.complete, savedAt: Date.now(), trips: result.rows.map(toSummary) });
      setTripsProblem(null);
    } catch (error) {
      logEvent('trips.refresh-failed', error);
      setTripsProblem('Could not refresh your trips. Showing the saved list.');
    } finally {
      setRefreshing(false);
    }
  }, [canReachServer, convex, live, setCache]);

  const selectedTripId = selected?.id ?? null;

  const refreshPack = useCallback(async () => {
    if (!(canReachServer && selectedTripId)) {
      return;
    }
    const jobCardId = selectedTripId;
    const current = live.fence();
    try {
      const [commandCenter, batches, travellers, tourManagers] = await Promise.all([
        convex.query(staffApi.getJobCardCommandCenter.ref, { jobCardId }),
        collectPages((cursor) => convex.query(staffApi.listTravelBatches.ref, { jobCardId, paginationOpts: firstPage(cursor) }), MAX_PAGES),
        collectPages((cursor) => convex.query(staffApi.listTravellers.ref, { jobCardId, paginationOpts: firstPage(cursor) }), MAX_PAGES),
        collectPages((cursor) => convex.query(staffApi.listTourManagers.ref, { jobCardId, paginationOpts: firstPage(cursor) }), MAX_PAGES),
      ]);
      if (!current()) return;
      const pack = buildTripPack({
        batches: batches.rows,
        commandCenter,
        complete: batches.complete && travellers.complete && tourManagers.complete,
        savedAt: Date.now(),
        tourManagers: tourManagers.rows,
        travellers: travellers.rows,
      });
      await savePack(store, pack);
      if (!current()) {
        // The wipe ran while the pack was being written; remove what landed after it.
        await deletePack(store, jobCardId);
        return;
      }
      setPackState({ jobCardId, loading: false, pack });
      setPackProblem(null);
    } catch (error) {
      logEvent('pack.refresh-failed', error);
      setPackProblem('Could not update the trip pack. Showing the saved copy.');
    }
  }, [canReachServer, convex, live, selectedTripId, store]);

  useEffect(() => {
    let active = true;
    purgeExpiredPacks(store, Date.now()).catch((error: unknown) => logEvent('pack.purge-failed', error));
    if (!selectedTripId) {
      return;
    }
    loadPack(store, selectedTripId, Date.now())
      .then((pack) => {
        if (!active) return;
        setPackState({ jobCardId: selectedTripId, loading: false, pack });
        if (!pack || Date.now() - pack.savedAt > PACK_STALE_MS) {
          void refreshPack();
        }
      })
      .catch((error: unknown) => {
        logEvent('pack.load-failed', error);
        if (active) setPackState({ jobCardId: selectedTripId, loading: false, pack: null });
      });
    return () => {
      active = false;
    };
  }, [refreshPack, selectedTripId, store]);

  useEffect(() => {
    if (canReachServer) {
      void Promise.resolve().then(refreshTrips);
    }
  }, [canReachServer, refreshTrips]);

  const shown = packState.jobCardId === selectedTripId ? packState : { loading: true, pack: null };
  const value: TripsValue = {
    chosen,
    pack: shown.pack,
    packLoading: shown.loading,
    packProblem,
    refreshPack,
    refreshTrips,
    refreshing,
    selectTrip: (jobCardId) => setSelectedId(jobCardId),
    selected,
    trips,
    tripsComplete: cache?.complete ?? true,
    tripsLoaded,
    tripsProblem,
    tripsSavedAt: cache?.savedAt ?? null,
  };
  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips() {
  const value = useContext(TripsContext);
  if (!value) {
    throw new Error('useTrips needs TripsProvider');
  }
  return value;
}
