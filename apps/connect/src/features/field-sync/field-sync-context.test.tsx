import { act, render, screen, waitFor } from '@testing-library/react-native';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';

import { FieldSyncProvider, useFieldSync } from './field-sync-context';
import { enqueuePush, type FieldPush, fieldOutboxKey, type SyncItem } from './queue';

let mockStore: KeyValueStore;
const mockSession = { online: true, staffId: 'staff_1' };
const mockMutation = jest.fn();

jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));
jest.mock('@/features/gate/session', () => ({
  useStaffSession: () => ({
    gate: { kind: 'staff', offline: false, staff: { name: 'T', roles: ['Tour Manager'], staffId: mockSession.staffId } },
    online: mockSession.online,
  }),
}));
const mockConvex = { mutation: (...args: unknown[]) => mockMutation(...args) };
jest.mock('convex/react', () => ({ useConvex: () => mockConvex }));

function stop(present: string[], clientUpdatedAt: number): FieldPush {
  return {
    args: { clientStopId: 'stop-1', clientUpdatedAt, day: '2026-11-06', jobCardId: 'jc_1', label: 'Start of day', presentTravellerIds: present, startedAt: 1 },
    kind: 'headcountStop',
  };
}

const handles: { sync: ReturnType<typeof useFieldSync> | null } = { sync: null };
function Probe() {
  const sync = useFieldSync();
  useEffect(() => {
    handles.sync = sync;
  });
  return <Text>{`items:${sync.items.map((item) => item.status).join(',') || 'none'}`}</Text>;
}

async function renderApp() {
  return render(
    <AppStoreProvider fallback={null}>
      <FieldSyncProvider>
        <Probe />
      </FieldSyncProvider>
    </AppStoreProvider>
  );
}

const pushedNames = () => mockMutation.mock.calls.map(([ref]) => getFunctionName(ref as Parameters<typeof getFunctionName>[0]));

beforeEach(() => {
  mockStore = jest.requireActual('@/lib/storage/memory-store').createMemoryStore();
  mockSession.online = true;
  mockSession.staffId = 'staff_1';
  mockMutation.mockReset();
  mockMutation.mockResolvedValue({ applied: true, id: 'srv_1', ignoredTravellerIds: 0 });
  handles.sync = null;
});

describe('field sync provider', () => {
  it('keeps changes made offline on disk, and after an app kill sends only the latest state', async () => {
    mockSession.online = false;
    const first = await renderApp();
    await screen.findByText('items:none');
    await act(async () => handles.sync?.enqueue(stop(['t_1'], 10)));
    await act(async () => handles.sync?.enqueue(stop(['t_1', 't_2'], 11)));
    expect(await screen.findByText('items:pending')).toBeOnTheScreen();
    expect(mockMutation).not.toHaveBeenCalled();
    expect(await mockStore.getJSON<SyncItem[]>(fieldOutboxKey)).toHaveLength(1);
    await first.unmount();

    // The app is started again later, with a connection.
    mockSession.online = true;
    await renderApp();
    expect(await screen.findByText('items:synced')).toBeOnTheScreen();
    expect(pushedNames()).toEqual(['crm/fieldSync:pushHeadcountStop']);
    expect(mockMutation.mock.calls[0]?.[1]).toEqual(stop(['t_1', 't_2'], 11).args);
  });

  it('sends a push again after the app was killed while it was in flight', async () => {
    mockMutation.mockReturnValueOnce(new Promise(() => undefined));
    const first = await renderApp();
    await screen.findByText('items:none');
    await act(async () => handles.sync?.enqueue(stop(['t_1'], 10)));
    await waitFor(() => expect(mockMutation).toHaveBeenCalledTimes(1));
    await first.unmount();

    await renderApp();
    expect(await screen.findByText('items:synced')).toBeOnTheScreen();
    expect(mockMutation).toHaveBeenCalledTimes(2);
    expect(mockMutation.mock.calls[1]?.[1]).toEqual(mockMutation.mock.calls[0]?.[1]);
  });

  it('keeps a network failure queued for a later retry', async () => {
    mockMutation.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderApp();
    await screen.findByText('items:none');
    await act(async () => handles.sync?.enqueue(stop(['t_1'], 10)));
    await waitFor(async () => expect((await mockStore.getJSON<SyncItem[]>(fieldOutboxKey))?.[0]).toMatchObject({ attempts: 1 }));
    expect(screen.getByText('items:pending')).toBeOnTheScreen();
  });

  it('stops sending a refused push when the tour manager discards it, and keeps it gone after a restart', async () => {
    mockMutation.mockRejectedValue(new ConvexError('FORBIDDEN'));
    const first = await renderApp();
    await screen.findByText('items:none');
    await act(async () => handles.sync?.enqueue(stop(['t_1'], 10)));
    expect(await screen.findByText('items:needsAttention')).toBeOnTheScreen();
    const key = handles.sync?.items[0]?.key ?? '';
    await act(async () => handles.sync?.discard([key]));
    expect(await screen.findByText('items:none')).toBeOnTheScreen();
    await first.unmount();

    await renderApp();
    expect(await screen.findByText('items:none')).toBeOnTheScreen();
    expect(mockMutation).toHaveBeenCalledTimes(1);
  });

  it('sends a push an earlier version queued, after reading its old flags', async () => {
    const [item] = enqueuePush([], stop(['t_1'], 10), 'staff_1', 0);
    if (!item) throw new Error('no item');
    // As earlier versions saved it: the state spread over side-by-side flags.
    await mockStore.setJSON(fieldOutboxKey, [{ ...item, ignoredTravellerIds: 0, newerOnServer: false, landed: undefined }]);
    await renderApp();
    expect(await screen.findByText('items:synced')).toBeOnTheScreen();
    expect(mockMutation.mock.calls[0]?.[1]).toEqual(item.args);
    expect((await mockStore.getJSON<SyncItem[]>(fieldOutboxKey))?.[0]).not.toHaveProperty('newerOnServer');
  });

  it('sends a change made while the earlier state was in flight as soon as that push lands', async () => {
    let land: () => void = () => undefined;
    const firstPush = new Promise<void>((resolve) => {
      land = resolve;
    });
    mockMutation.mockImplementationOnce(async () => {
      await firstPush;
      return { applied: true, id: 'srv_1', ignoredTravellerIds: 0 };
    });
    await renderApp();
    await screen.findByText('items:none');
    await act(async () => handles.sync?.enqueue(stop(['t_1'], 10)));
    await waitFor(() => expect(mockMutation).toHaveBeenCalledTimes(1));

    // The tour manager marks another traveller while the first push is on its way.
    await act(async () => handles.sync?.enqueue(stop(['t_1', 't_2'], 11)));
    expect(mockMutation).toHaveBeenCalledTimes(1);
    await act(async () => land());

    // No waiting for the 30-second timer: the newer state goes straight after.
    expect(await screen.findByText('items:synced')).toBeOnTheScreen();
    expect(mockMutation).toHaveBeenCalledTimes(2);
    expect(mockMutation.mock.calls[1]?.[1]).toEqual(stop(['t_1', 't_2'], 11).args);
  });

  it("neither shows nor sends another staff member's queued pushes", async () => {
    await mockStore.setJSON(fieldOutboxKey, enqueuePush([], stop(['t_9'], 10), 'staff_2', 0));
    await renderApp();
    expect(await screen.findByText('items:none')).toBeOnTheScreen();
    await act(async () => handles.sync?.enqueue(stop(['t_1'], 12)));
    expect(await screen.findByText('items:synced')).toBeOnTheScreen();
    expect(mockMutation).toHaveBeenCalledTimes(1);
    expect(mockMutation.mock.calls[0]?.[1]).toMatchObject({ presentTravellerIds: ['t_1'] });
  });
});
