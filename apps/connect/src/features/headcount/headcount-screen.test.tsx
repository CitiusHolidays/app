import { fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import Headcount from '@/app/headcount';
import type { FieldPush, SyncItem } from '@/features/field-sync/queue';
import { enqueuePush, syncKey } from '@/features/field-sync/queue';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { AppStoreProvider } from '@/lib/app-store';
import { renderWithTheme } from '@/test/render';

jest.mock('@/lib/storage/device-store', () => ({
  openDeviceStore: async () => jest.requireActual('@/lib/storage/memory-store').createMemoryStore(),
}));

const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers });
jest.mock('@/features/trips/trips-context', () => ({
  useTrips: () => ({ pack: mockPack, selected: { id: mockPack.jobCardId } }),
}));
const mockSync = { enqueue: jest.fn(), items: [] as SyncItem[], retry: jest.fn() };
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => mockSync }));

const lastPush = () => mockSync.enqueue.mock.calls.at(-1)?.[0] as FieldPush;

describe('headcount screen', () => {
  let announce: jest.SpyInstance;
  beforeEach(() => {
    mockSync.enqueue.mockReset();
    mockSync.retry.mockReset();
    mockSync.items = [];
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });
  afterEach(() => announce.mockRestore());

  it('counts travellers as they are tapped, lists who is not marked, and announces the count on iOS', async () => {
    await renderWithTheme(
      <AppStoreProvider fallback={null}>
        <Headcount />
      </AppStoreProvider>
    );
    expect(await screen.findByLabelText('0 of 3 here')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Asha Example' }));
    expect(await screen.findByLabelText('1 of 3 here')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Asha Example' })).toBeChecked();
    expect(announce).toHaveBeenCalledWith('1 of 3 here');

    await fireEvent.press(screen.getByRole('radio', { name: 'Bus 2' }));
    expect(await screen.findByLabelText('0 of 1 here')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Asha Example' })).not.toBeOnTheScreen();
  });

  it('starts a new stop with nobody marked', async () => {
    await renderWithTheme(
      <AppStoreProvider fallback={null}>
        <Headcount />
      </AppStoreProvider>
    );
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Zed Example' }));
    await fireEvent.changeText(screen.getByLabelText('Next stop'), 'Temple car park');
    await fireEvent.press(screen.getByRole('button', { name: 'Start new stop' }));
    expect(await screen.findByLabelText('0 of 3 here')).toBeOnTheScreen();
    expect(screen.getByText(/Temple car park/)).toBeOnTheScreen();
  });

  it('sends each change of the stop to the office, as a count of the whole group', async () => {
    await renderWithTheme(
      <AppStoreProvider fallback={null}>
        <Headcount />
      </AppStoreProvider>
    );
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Asha Example' }));
    expect(lastPush()).toMatchObject({ args: { jobCardId: mockPack.jobCardId, label: 'Start of day', presentTravellerIds: ['t_2'] }, kind: 'headcountStop' });
    const firstStop = lastPush().args;

    await fireEvent.press(screen.getByRole('radio', { name: 'Bus 2' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Bina Example' }));
    expect(lastPush().args).toMatchObject({ presentTravellerIds: ['t_2', 't_3'] });
    expect(lastPush().args).not.toHaveProperty('travelBatchId');
    expect(syncKey(lastPush())).toBe(syncKey({ args: firstStop, kind: 'headcountStop' } as FieldPush));

    await fireEvent.changeText(screen.getByLabelText('Next stop'), 'Temple car park');
    await fireEvent.press(screen.getByRole('button', { name: 'Start new stop' }));
    expect(lastPush().args).toMatchObject({ label: 'Temple car park', presentTravellerIds: [] });
  });

  it('shows whether the count has reached the office', async () => {
    await renderWithTheme(
      <AppStoreProvider fallback={null}>
        <Headcount />
      </AppStoreProvider>
    );
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Asha Example' }));
    const [queued] = enqueuePush([], lastPush(), 'staff_1', Date.now());
    if (!queued) throw new Error('no item');

    mockSync.items = [queued];
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Zed Example' }));
    expect(screen.getByLabelText('Waiting to sync')).toBeOnTheScreen();

    mockSync.items = [{ ...queued, ignoredTravellerIds: 1, status: 'synced', syncedAt: Date.now() }];
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Zed Example' }));
    expect(screen.getByLabelText(/^Synced to office \d{2}:\d{2}$/)).toBeOnTheScreen();
    expect(screen.getByText(/1 marked traveller is not in your group/)).toBeOnTheScreen();

    mockSync.items = [{ ...queued, problem: 'The office did not accept this.', status: 'needsAttention' }];
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Zed Example' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(mockSync.retry).toHaveBeenCalledWith([queued.key]);
  });
});
