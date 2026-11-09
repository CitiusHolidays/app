import { type JobCardRow, type PaginationOpts, staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useReducer, useState } from 'react';
import { AppState, useWindowDimensions } from 'react-native';

import { useCanReachServer } from '@/features/gate/reach';
import { type PackAction, packOf, packPending, packReducer, type PackStatus, STALE_PACK_PROBLEM } from '@/features/trip-pack/pack-status';
import { deletePack, loadPack, prunePacksNotIn, purgeExpiredPacks, savePack } from '@/features/trip-pack/pack-store';
import { buildTripPack, type TripPack } from '@/features/trip-pack/trip-pack';
import { useAppStore, useStoredValue } from '@/lib/app-store';
import { refusalData } from '@/lib/refusal';
import { logEvent } from '@/lib/safe-log';
import { prefetchCover } from '@/features/trips/prefetch-cover';
import { useNow } from '@/lib/use-now';

import { collectPages, pickDefaultTrip, sortTrips } from './trips';
import { type TripsFetch, type TripsListStatus, tripsListStatus, tripsProblemText } from './trips-list';

export type TripSummary = Pick<
  JobCardRow,
  'clientName' | 'destination' | 'id' | 'jobCode' | 'status' | 'travelBatchCount' | 'travelEndDate' | 'travelStartDate'
>;

interface TripsCache {
  complete: boolean;
  savedAt: number;
  /**
   * 'assigned': read from the tour manager's own assignments. Lists saved by earlier versions
   * (from the general Job Card list) have no scope and are not shown.
   */
  scope?: 'assigned';
  trips: TripSummary[];
}

interface TripsValue {
  /** False offline or while the server is not answering: refreshes would do nothing. */
  canRefresh: boolean;
  /** Derived from `packStatus`: the pack to show, if any. */
  pack: TripPack | null;
  /** Derived from `packStatus`: still reading the saved copy or downloading the first one. */
  packLoading: boolean;
  /** Derived from `packStatus`: set only when a saved pack is shown after its refresh failed. */
  packProblem: string | null;
  /** The selected trip's pack on this phone. */
  packStatus: PackStatus;
  refreshPack: () => Promise<void>;
  refreshTrips: () => Promise<void>;
  /** Derived from the trip list download: true while it runs. */
  refreshing: boolean;
  selectTrip: (jobCardId: string) => void;
  selected: TripSummary | null;
  trips: TripSummary[];
  /** False when the server had more pages than the app reads: the list may be missing trips. */
  tripsComplete: boolean;
  /** The phone's saved list has been read. */
  tripsLoaded: boolean;
  /** Derived from the trip list download: why the last one failed, if it did. */
  tripsProblem: string | null;
  tripsSavedAt: number | null;
  tripsStatus: TripsListStatus;
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

/** Tells shared CRM reads this call is from the app, so a trip whose app pilot is off is refused. */
const CONNECT = 'connect' as const;

/** The server refuses app reads for a trip whose app pilot was stopped. */
const isPilotOff = (error: unknown) => refusalData(error) === 'APP_PILOT_OFF';

/** Every trip's pack status, each moved on by its own actions. */
function packsReducer(packs: Readonly<Record<string, PackStatus>>, { action, jobCardId }: { action: PackAction; jobCardId: string }) {
  return { ...packs, [jobCardId]: packReducer(packs[jobCardId], action) };
}

const LOADING: PackStatus = { kind: 'loading' };

export function TripsProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { live, store } = useAppStore();
  const canReachServer = useCanReachServer();
  const [storedCache, setCache, tripsLoaded] = useStoredValue<TripsCache | null>('trips:list', null);
  const cache = storedCache?.scope === 'assigned' ? storedCache : null;
  const [selectedId, setSelectedId] = useStoredValue<string | null>('trips:selected', null);
  const [tripsFetch, setTripsFetch] = useState<TripsFetch>({ kind: 'idle' });
  // Each trip's pack has its own status, so switching trips never carries one trip's problem over.
  const [packs, updatePack] = useReducer(packsReducer, {});
  // The trip card's photo is saved with the pack at the width the card will ask for.
  const { width: windowWidth } = useWindowDimensions();

  const now = useNow();
  const trips = sortTrips(cache?.trips ?? [], now);
  // The trip the tour manager picked, while it is still in their list; otherwise the best guess.
  const selected = trips.find((trip) => trip.id === selectedId) ?? pickDefaultTrip(trips, now);

  const refreshTrips = useCallback(async () => {
    if (!canReachServer) {
      return;
    }
    setTripsFetch({ kind: 'loading' });
    // Signing out (or a change of user) wipes the store; a refresh begun before that must not
    // write the previous user's trips back.
    const current = live.fence();
    const load = async () => {
      // Only the trips this tour manager is assigned to, one row per Job Card.
      const result = await collectPages(
        (cursor) => convex.query(staffApi.listMyAssignedJobCards.ref, { paginationOpts: firstPage(cursor) }),
        MAX_PAGES
      );
      if (!current()) return;
      void setCache({ complete: result.complete, savedAt: Date.now(), scope: 'assigned', trips: result.rows.map(toSummary) });
      if (result.complete) {
        // A trip that left the list (unassigned, or its app pilot was stopped) must not stay
        // readable on the phone.
        await prunePacksNotIn(
          store,
          result.rows.map((row) => row.id)
        );
      }
      setTripsFetch({ kind: 'loaded' });
    };
    await load().catch((error: unknown) => {
      logEvent('trips.refresh-failed', error);
      setTripsFetch({ kind: 'failed' });
    });
  }, [canReachServer, convex, live, setCache, store]);

  // A template string tells the React Compiler this is a plain string: with `selected?.id` it
  // assumes the pack updates below could change it and drops the callbacks' memoisation.
  const selectedTripId = selected ? `${selected.id}` : null;

  const refreshPack = useCallback(async () => {
    if (!(canReachServer && selectedTripId)) {
      return;
    }
    const jobCardId = selectedTripId;
    const current = live.fence();
    updatePack({ action: { type: 'fetch' }, jobCardId });
    try {
      const [commandCenter, batches, travellers, tourManagers] = await Promise.all([
        convex.query(staffApi.getJobCardCommandCenter.ref, { jobCardId, surface: CONNECT }),
        collectPages((cursor) => convex.query(staffApi.listTravelBatches.ref, { jobCardId, paginationOpts: firstPage(cursor), surface: CONNECT }), MAX_PAGES),
        collectPages((cursor) => convex.query(staffApi.listTravellers.ref, { jobCardId, paginationOpts: firstPage(cursor), surface: CONNECT }), MAX_PAGES),
        collectPages((cursor) => convex.query(staffApi.listTourManagers.ref, { jobCardId, paginationOpts: firstPage(cursor), surface: CONNECT }), MAX_PAGES),
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
      prefetchCover(pack.cover, windowWidth);
      if (!current()) {
        // The wipe ran while the pack was being written; remove what landed after it.
        await deletePack(store, jobCardId);
        return;
      }
      updatePack({ action: { pack, type: 'fetched' }, jobCardId });
    } catch (error) {
      if (isPilotOff(error)) {
        // Operations stopped the app for this trip: nothing about it stays on the phone.
        await deletePack(store, jobCardId);
        if (!current()) return;
        updatePack({ action: { type: 'off' }, jobCardId });
        void refreshTrips();
        return;
      }
      logEvent('pack.refresh-failed', error);
      if (current()) updatePack({ action: { type: 'fetchFailed' }, jobCardId });
    }
  }, [canReachServer, convex, live, refreshTrips, selectedTripId, store, updatePack, windowWidth]);

  // At start-up, on a change of trip, and each time the app comes back to the foreground: drop
  // expired packs, read the selected trip's saved copy, and refresh it when missing or stale.
  useEffect(() => {
    let active = true;
    const check = () => {
      purgeExpiredPacks(store, Date.now()).catch((error: unknown) => logEvent('pack.purge-failed', error));
      if (!selectedTripId) {
        return;
      }
      loadPack(store, selectedTripId, Date.now())
        .then((pack) => {
          if (!active) return;
          updatePack({ action: { pack, type: 'read' }, jobCardId: selectedTripId });
          if (!pack || Date.now() - pack.savedAt > PACK_STALE_MS) {
            void refreshPack();
          }
        })
        .catch((error: unknown) => {
          logEvent('pack.load-failed', error);
          if (active) updatePack({ action: { pack: null, type: 'read' }, jobCardId: selectedTripId });
        });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [refreshPack, selectedTripId, store, updatePack]);

  useEffect(() => {
    if (canReachServer) {
      void Promise.resolve().then(refreshTrips);
    }
  }, [canReachServer, refreshTrips]);

  const packStatus = (selectedTripId === null ? undefined : packs[selectedTripId]) ?? LOADING;
  const value: TripsValue = {
    canRefresh: canReachServer,
    pack: packOf(packStatus),
    packLoading: packPending(packStatus),
    packProblem: packStatus.kind === 'stale' ? STALE_PACK_PROBLEM : null,
    packStatus,
    refreshPack,
    refreshTrips,
    refreshing: tripsFetch.kind === 'loading',
    selectTrip: (jobCardId) => setSelectedId(jobCardId),
    selected,
    trips,
    tripsComplete: cache?.complete ?? true,
    tripsLoaded,
    tripsProblem: tripsProblemText(tripsFetch, trips.length > 0),
    tripsSavedAt: cache?.savedAt ?? null,
    tripsStatus: tripsListStatus({ canReachServer, count: trips.length, fetch: tripsFetch, hasSavedList: cache !== null, read: tripsLoaded }),
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
