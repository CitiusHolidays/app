import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { FieldPush } from '@/features/field-sync/queue';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { AppStoreProvider } from '@/lib/app-store';

import { createAnnouncement } from './announcements';
import { useAnnouncements } from './use-announcements';

jest.mock('@/lib/storage/device-store', () => ({
  openDeviceStore: async () => jest.requireActual('@/lib/storage/memory-store').createMemoryStore(),
}));
const mockEnqueue = jest.fn();
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => ({ enqueue: mockEnqueue }) }));

const pack = buildTripPack({ batches, commandCenter, complete: true, savedAt: 0, tourManagers, travellers });
const wrapper = ({ children }: { children: ReactNode }) => <AppStoreProvider fallback={null}>{children}</AppStoreProvider>;
const lastPush = () => mockEnqueue.mock.calls.at(-1)?.[0] as FieldPush;

describe('useAnnouncements', () => {
  it('records a shared announcement for the office, and sends the checklist again when it changes', async () => {
    const { result } = await renderHook(() => useAnnouncements(pack.jobCardId), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const announcement = createAnnouncement({ audience: { kind: 'trip' }, body: 'Bus at 8:15', id: 'ann_1', now: 100, pack });
    await act(async () => result.current.add(announcement));
    expect(lastPush()).toMatchObject({ args: { clientAnnouncementId: 'ann_1', recipientTravellerIds: ['t_2', 't_1', 't_3'], seenByTravellerIds: [] } });

    await act(async () => result.current.toggleAck('ann_1', 't_3'));
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(lastPush().args).toMatchObject({ clientAnnouncementId: 'ann_1', seenByTravellerIds: ['t_3'] });
    expect(lastPush().args.clientUpdatedAt).toBeGreaterThan(100);
    expect(result.current.log[0]?.acknowledgedIds).toEqual(['t_3']);

    // Someone who was not sent it changes nothing, so nothing is sent.
    await act(async () => result.current.toggleAck('ann_1', 't_4'));
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
  });
});
