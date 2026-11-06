import { act, render, screen, waitFor } from '@testing-library/react-native';
import { getFunctionName } from 'convex/server';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { AppStoreProvider, useAppStore } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';
import type { LiveStore } from '@/lib/storage/live-store';

import { TripsProvider, useTrips } from './trips-context';

let mockStore: KeyValueStore;
let mockHold: Promise<void> | null = null;
let mockTravellerPagesDone = true;

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
  if (name === 'crm/jobCards:listPage') return page([commandCenter.jobCard]);
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
    <Text>{`trips:${value.trips.length} pack:${value.pack ? (value.pack.complete ? 'complete' : 'partial') : 'none'} chosen:${value.chosen?.id ?? 'none'}`}</Text>
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
  mockQuery.mockImplementation(serverQuery);
});

describe('trips provider', () => {
  it('saves the trip list and pack, and never treats the default trip as chosen', async () => {
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:complete chosen:none')).toBeOnTheScreen();
    await act(async () => handles.trips?.selectTrip(commandCenter.jobCard.id));
    expect(await screen.findByText(`trips:1 pack:complete chosen:${commandCenter.jobCard.id}`)).toBeOnTheScreen();
  });

  it('marks the pack partial when a list hit the page budget', async () => {
    mockTravellerPagesDone = false;
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:partial chosen:none')).toBeOnTheScreen();
  });

  it('does not write a pack that was still loading when the store was wiped', async () => {
    await renderTrips();
    expect(await screen.findByText('trips:1 pack:complete chosen:none')).toBeOnTheScreen();
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
});
