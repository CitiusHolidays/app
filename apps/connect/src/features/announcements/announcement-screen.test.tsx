import { fireEvent, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import AnnouncementDetail from '@/app/announcement/[id]';
import { syncedAt } from '@/features/field-sync/fixtures';
import { announcementPush } from '@/features/field-sync/pushes';
import { enqueuePush, type FieldPush, type SyncItem } from '@/features/field-sync/queue';
import { savePack } from '@/features/trip-pack/pack-store';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';
import { renderWithTheme } from '@/test/render';

import { announcementsKey, createAnnouncement } from './announcements';

let mockStore: KeyValueStore;
const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: 0, tourManagers, travellers });
const mockJobCard = commandCenter.jobCard;
const mockSync = { discard: jest.fn(), enqueue: jest.fn(), items: [] as SyncItem[], retry: jest.fn() };
const mockParams: { id: string; trip?: string } = { id: 'ann_1' };

jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => mockSync }));
jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => ({ pack: mockPack, selected: mockJobCard, trips: [mockJobCard] }) }));
jest.mock('@/features/gate/session', () => ({ useStaff: () => ({ name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));

const announcement = createAnnouncement({ audience: { batchId: 'tb_1', kind: 'batch' }, body: 'Bus at 8:15', id: 'ann_1', now: 100, pack: mockPack });

/** Another trip on this phone, not the one selected on Today. */
const otherPack = { ...mockPack, destination: 'Goa', expiresAt: Number.MAX_SAFE_INTEGER, jobCardId: 'jc_other', jobCode: 'JC-OTHER' };
const otherAnnouncement = createAnnouncement({ audience: { kind: 'trip' }, body: 'Ferry at noon', id: 'ann_2', now: 200, pack: otherPack });

async function renderDetail() {
  return renderWithTheme(
    <AppStoreProvider fallback={null}>
      <AnnouncementDetail />
    </AppStoreProvider>
  );
}

describe('announcement detail', () => {
  beforeEach(async () => {
    mockStore = jest.requireActual('@/lib/storage/memory-store').createMemoryStore();
    await mockStore.setJSON(announcementsKey(mockPack.jobCardId), [announcement]);
    await mockStore.setJSON(announcementsKey(otherPack.jobCardId), [otherAnnouncement]);
    mockSync.enqueue.mockReset();
    mockSync.items = [];
    mockParams.id = 'ann_1';
    delete mockParams.trip;
  });

  it('shows whether the office has the announcement, and sends the checklist when it changes', async () => {
    const [queued] = enqueuePush([], announcementPush(announcement), 'staff_1', 100);
    if (!queued) throw new Error('no item');
    mockSync.items = [queued];
    await renderDetail();
    expect(await screen.findByLabelText('Waiting to sync')).toBeOnTheScreen();

    mockSync.items = [syncedAt(queued, Date.now())];
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Zed Example' }));
    expect(screen.getByLabelText(/^Synced to office \d{2}:\d{2}$/)).toBeOnTheScreen();
    const push = mockSync.enqueue.mock.calls.at(-1)?.[0] as FieldPush;
    expect(push.args).toMatchObject({ clientAnnouncementId: 'ann_1', seenByTravellerIds: ['t_1'], travelBatchId: 'tb_1' });
  });

  it('opens an announcement from another trip than the one selected, with that trip’s names and label', async () => {
    await savePack(mockStore, otherPack);
    mockParams.id = 'ann_2';
    mockParams.trip = otherPack.jobCardId;
    await renderDetail();
    expect(await screen.findByText('Ferry at noon')).toBeOnTheScreen();
    expect(await screen.findByRole('checkbox', { name: 'Asha Example' })).toBeOnTheScreen();

    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await fireEvent.press(screen.getByRole('button', { name: 'Share again' }));
    expect(share.mock.calls[0]?.[0]).toMatchObject({ message: expect.stringMatching(/^JC-OTHER Goa · To your group/) });
    share.mockRestore();
  });

  it('finds an announcement from a link without its trip by searching every trip on the phone', async () => {
    mockParams.id = 'ann_2';
    await renderDetail();
    expect(await screen.findByText('Ferry at noon')).toBeOnTheScreen();
    // No saved pack for that trip: the checklist says the names are not here, not that they left.
    expect(screen.getAllByRole('checkbox', { name: 'Name not on this phone' }).length).toBeGreaterThan(0);
  });

  it('says the announcement is not on this phone only once every trip has been searched', async () => {
    mockParams.id = 'ann_gone';
    await renderDetail();
    expect(await screen.findByLabelText('This announcement is not on this phone.')).toBeOnTheScreen();
  });

  it('says so when the audience had nobody in it, instead of an empty checklist', async () => {
    const nobody = { ...announcement, acknowledgedIds: [], id: 'ann_3', recipientIds: [] };
    await mockStore.setJSON(announcementsKey(mockPack.jobCardId), [nobody]);
    mockParams.id = 'ann_3';
    await renderDetail();
    expect(await screen.findByLabelText('No travellers in this audience, so there is nobody to tick.')).toBeOnTheScreen();
    expect(screen.queryByText(/Tick each traveller/)).not.toBeOnTheScreen();
  });
});
