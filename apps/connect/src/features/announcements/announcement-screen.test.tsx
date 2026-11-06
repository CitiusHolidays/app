import { fireEvent, screen } from '@testing-library/react-native';

import AnnouncementDetail from '@/app/announcement/[id]';
import { announcementPush } from '@/features/field-sync/pushes';
import { enqueuePush, type FieldPush, type SyncItem } from '@/features/field-sync/queue';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';
import { renderWithTheme } from '@/test/render';

import { announcementsKey, createAnnouncement } from './announcements';

let mockStore: KeyValueStore;
const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: 0, tourManagers, travellers });
const mockJobCard = commandCenter.jobCard;
const mockSync = { enqueue: jest.fn(), items: [] as SyncItem[], retry: jest.fn() };

jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => mockSync }));
jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => ({ pack: mockPack, selected: mockJobCard }) }));
jest.mock('@/features/gate/session', () => ({ useStaff: () => ({ name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'ann_1' }) }));

const announcement = createAnnouncement({ audience: { batchId: 'tb_1', kind: 'batch' }, body: 'Bus at 8:15', id: 'ann_1', now: 100, pack: mockPack });

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
    mockSync.enqueue.mockReset();
    mockSync.items = [];
  });

  it('shows whether the office has the announcement, and sends the checklist when it changes', async () => {
    const [queued] = enqueuePush([], announcementPush(announcement), 'staff_1', 100);
    if (!queued) throw new Error('no item');
    mockSync.items = [queued];
    await renderDetail();
    expect(await screen.findByLabelText('Waiting to sync')).toBeOnTheScreen();

    mockSync.items = [{ ...queued, status: 'synced', syncedAt: Date.now() }];
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Zed Example' }));
    expect(screen.getByLabelText(/^Synced to office \d{2}:\d{2}$/)).toBeOnTheScreen();
    const push = mockSync.enqueue.mock.calls.at(-1)?.[0] as FieldPush;
    expect(push.args).toMatchObject({ clientAnnouncementId: 'ann_1', seenByTravellerIds: ['t_1'], travelBatchId: 'tb_1' });
  });
});
