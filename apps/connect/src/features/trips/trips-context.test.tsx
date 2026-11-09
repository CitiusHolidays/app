import { act, render, screen, waitFor } from '@testing-library/react-native';
import { getFunctionName } from 'convex/server';
import { useEffect } from 'react';
import { AppState, Text } from 'react-native';

import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { AppStoreProvider, useAppStore } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';
import type { LiveStore } from '@/lib/storage/live-store';

import { TripsProvider, useTrips } from './trips-context';

let mockStore: KeyValueStore;
let mockHold: Promise<void> | null = null;
let mockTravellerPagesDone = true;
let mockTripPagesDone = true;

const savedPack = (jobCardId: string) => ({
  ...buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers }),
  jobCardId,
});

const page = <Row,>(rows: Row[], isDone = true) => ({ continueCursor: 'next', isDone, page: rows });

jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));
jest.mock('@/features/gate/session', () => ({
  useStaffSession: () => ({ gate: { kind: 'staff', offline: false, staff: { name: 'T', roles: ['Tour Manager'], staffId: 'staff_1' } }, online: true }),
}));
const mockQuery = jest.fn();
// One client for the app's life, like the real ConvexReactClient.
const mockConvex = { query: (...args: unknown[]) => mockQuery(...args) };
jest.mock('convex/react', () => ({ useConvex: () => mockConvex }));

async function serverQuery(ref: unknown) {
  const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
  if (mockHold) await mockHold;
  if (name === 'crm/jobCards:listMyAssignedPage') return page([commandCenter.jobCard], mockTripPagesDone);
  if (name === 'crm/jobCards:getCommandCenter') return commandCenter;
  if (name === 'crm/jobCards:listTravelBatches') return page(batches);
  if (name === 'crm/travellers:listPage') return page(travellers, mockTravellerPagesDone);
  if (name === 'crm/ops:listTourManagers') return page(tourManagers);
  throw new Error(`unexpected ${name}`);
}

const handles: { live: LiveStore | null; trips: ReturnType<typeof useTrips> | null } = { live: null, trips: null };
function Probe() {
  const value = useTrips();
  const { live } = useAppStore();
  useEffect(() => {
    handles.trips = value;
    handles.live = live;
  });
  return (
    <Text>{`trips:${value.trips.length}${value.tripsComplete ? '' : ' (partial)'} pack:${value.pack ? (value.pack.complete ? 'complete' : 'partial') : 'none'}`}</Text>
  );
}

async function renderTrips() {
  return render(
    <AppStoreProvider fallback={null}>
      <TripsProvider>
        <Probe />
      </TripsProvider>
    </AppStoreProvider>
  );
}

beforeEach(() => {
  mockStore = jest.requireActual('@/lib/storage/memory-store').createMemoryStore();
  mockHold = null;
  mockTravellerPagesDone = true;
  mockTripPagesDone = true;
  mockQuery.mockImplementation(serverQuery);
});

const calledNames = () => mockQuery.mock.calls.map(([ref]) => getFunctionName(ref as Parameters<typeof getFunctionName>[0]));

describe('trips provider', () => {
  it('deletes the saved pack of a trip that left the list (pilot stopped or unassigned) after a complete refresh', async () => {
    await mockStore.setJSON('pack:jc_paused', savedPack('jc_paused'));
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:complete')).toBeOnTheScreen();
    await waitFor(async () => expect(await mockStore.keys('pack:')).toEqual([`pack:${commandCenter.jobCard.id}`]));
  });

  it('asks the shared trip reads for the app view, so a stopped pilot is refused there', async () => {
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:complete')).toBeOnTheScreen();
    const appReads = mockQuery.mock.calls.filter(([ref]) =>
      ['crm/jobCards:getCommandCenter', 'crm/jobCards:listTravelBatches', 'crm/travellers:listPage', 'crm/ops:listTourManagers'].includes(
        getFunctionName(ref as Parameters<typeof getFunctionName>[0])
      )
    );
    expect(appReads.length).toBeGreaterThanOrEqual(4);
    expect(appReads.every(([, args]) => (args as { surface?: string }).surface === 'connect')).toBe(true);
  });

  it('deletes the saved trip when the office has stopped the app for it', async () => {
    const jobCardId = commandCenter.jobCard.id;
    await mockStore.setJSON(`pack:${jobCardId}`, { ...savedPack(jobCardId), savedAt: 0 });
    mockQuery.mockImplementation(async (ref: unknown) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
      if (name === 'crm/jobCards:listMyAssignedPage') return page([commandCenter.jobCard]);
      throw Object.assign(new Error('refused'), { data: 'APP_PILOT_OFF' });
    });
    await renderTrips();
    await waitFor(async () => expect(await mockStore.keys('pack:')).toEqual([]));
    await waitFor(() => expect(handles.trips?.packStatus.kind).toBe('off'));
    // The banner explains it; the freshness notice does not repeat it.
    expect(handles.trips?.packProblem).toBeNull();
  });

  it('keeps saved packs when the trip list came back incomplete', async () => {
    mockTripPagesDone = false;
    await mockStore.setJSON('pack:jc_other_page', savedPack('jc_other_page'));
    await renderTrips();
    expect(await screen.findByText(/\(partial\)/)).toBeOnTheScreen();
    expect(await mockStore.keys('pack:')).toContain('pack:jc_other_page');
  });

  it("lists only the tour manager's own assigned trips, never the general Job Card list", async () => {
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:complete')).toBeOnTheScreen();
    expect(calledNames()).toContain('crm/jobCards:listMyAssignedPage');
    expect(calledNames()).not.toContain('crm/jobCards:listPage');
    expect(await mockStore.getJSON('trips:list')).toMatchObject({ complete: true, scope: 'assigned', trips: [{ id: commandCenter.jobCard.id }] });
  });

  it('keeps paging the assigned list and says when it stopped before the end', async () => {
    mockTripPagesDone = false;
    await renderTrips();
    expect(await screen.findByText('trips:10 (partial) pack:complete')).toBeOnTheScreen();
  });

  it('does not show a trip list saved from the general Job Card list by an earlier version', async () => {
    mockQuery.mockImplementation(async (ref: unknown) => {
      if (getFunctionName(ref as Parameters<typeof getFunctionName>[0]) === 'crm/jobCards:listMyAssignedPage') {
        return new Promise(() => undefined);
      }
      return serverQuery(ref);
    });
    await mockStore.setJSON('trips:list', { complete: true, savedAt: 1, trips: [{ ...commandCenter.jobCard, id: 'jc_not_mine' }] });
    await renderTrips();
    expect(await screen.findByText('trips:0 pack:none')).toBeOnTheScreen();
  });

  it('saves the trip list and pack, and shows the trip the tour manager picks', async () => {
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:complete')).toBeOnTheScreen();
    await act(async () => handles.trips?.selectTrip(commandCenter.jobCard.id));
    expect(handles.trips?.selected?.id).toBe(commandCenter.jobCard.id);
  });

  it('marks the pack partial when a list hit the page budget', async () => {
    mockTravellerPagesDone = false;
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:partial')).toBeOnTheScreen();
  });

  it('does not write a pack that was still loading when the store was wiped', async () => {
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:complete')).toBeOnTheScreen();
    let release: () => void = () => undefined;
    mockHold = new Promise((resolve) => {
      release = resolve;
    });
    let refresh: Promise<void> | undefined;
    await act(async () => {
      refresh = handles.trips?.refreshPack();
      await handles.live?.wipe();
    });
    await act(async () => {
      release();
      await refresh;
    });
    await waitFor(async () => expect(await mockStore.keys('pack:')).toEqual([]));
    expect(await mockStore.getJSON('trips:list')).toBeNull();
  });

  it("never shows one trip's pack problem on another trip", async () => {
    const other = { ...commandCenter.jobCard, id: 'jc_other' };
    const jobCardId = commandCenter.jobCard.id;
    await mockStore.setJSON(`pack:${jobCardId}`, { ...savedPack(jobCardId), savedAt: 0 });
    await mockStore.setJSON('pack:jc_other', savedPack('jc_other'));
    mockQuery.mockImplementation(async (ref: unknown) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
      if (name === 'crm/jobCards:listMyAssignedPage') return page([commandCenter.jobCard, other]);
      throw new Error('network');
    });
    await renderTrips();
    await waitFor(() => expect(handles.trips?.packStatus.kind).toBe('stale'));
    expect(handles.trips?.packProblem).toBe('Could not update the trip pack. Showing the saved copy.');
    await act(async () => handles.trips?.selectTrip('jc_other'));
    await waitFor(() => expect(handles.trips?.packStatus.kind).toBe('ready'));
    expect(handles.trips?.packProblem).toBeNull();
  });

  it('says it is still loading the first trip list, rather than that there are no trips', async () => {
    let release: () => void = () => undefined;
    mockHold = new Promise((resolve) => {
      release = resolve;
    });
    await renderTrips();
    await waitFor(() => expect(handles.trips?.tripsStatus.kind).toBe('loading'));
    await act(async () => release());
    await waitFor(() => expect(handles.trips?.tripsStatus.kind).toBe('ready'));
  });

  it('says the first trip list could not be loaded, and an empty answer means no trips', async () => {
    mockQuery.mockImplementation(async () => {
      throw new Error('network');
    });
    await renderTrips();
    await waitFor(() => expect(handles.trips?.tripsStatus.kind).toBe('failed'));
    expect(handles.trips?.tripsProblem).toBe('Could not load your trips. Pull down to try again.');

    mockQuery.mockImplementation(async () => page([]));
    await act(async () => handles.trips?.refreshTrips());
    expect(handles.trips?.tripsStatus.kind).toBe('empty');
    expect(handles.trips?.tripsProblem).toBeNull();
  });

  it('refreshes a stale pack when the app comes back to the foreground', async () => {
    const listeners: ((state: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    try {
      await renderTrips();
      expect(await screen.findByText('trips:1 pack:complete')).toBeOnTheScreen();
      const jobCardId = commandCenter.jobCard.id;
      await waitFor(async () => expect(await mockStore.getJSON(`pack:${jobCardId}`)).not.toBeNull());
      await mockStore.setJSON(`pack:${jobCardId}`, { ...savedPack(jobCardId), savedAt: Date.now() - 60 * 60 * 1000 });
      mockQuery.mockClear();
      await act(async () => listeners.forEach((listener) => listener('active')));
      await waitFor(() => expect(calledNames()).toContain('crm/jobCards:getCommandCenter'));
    } finally {
      spy.mockRestore();
    }
  });
});
