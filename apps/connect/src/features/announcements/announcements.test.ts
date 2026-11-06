import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';

import { ackSummary, composeShareText, createAnnouncement, recipientsFor, toggleAck } from './announcements';

const pack = buildTripPack({ batches, commandCenter, complete: true, savedAt: 0, tourManagers, travellers });

describe('announcements', () => {
  it('targets the whole trip or one travel batch, travelling people only', () => {
    expect(recipientsFor(pack, { kind: 'trip' }).map((r) => r.id)).toEqual(['t_2', 't_1', 't_3']);
    expect(recipientsFor(pack, { batchId: 'tb_2', kind: 'batch' }).map((r) => r.id)).toEqual(['t_3']);
  });

  it("names the group audience as the tour manager's own group, since the roster is narrowed to it", () => {
    expect(createAnnouncement({ audience: { kind: 'trip' }, body: 'Hi', id: 'a0', now: 5, pack }).audienceLabel).toBe('your group');
  });

  it('writes a share message with the audience and sender', () => {
    expect(
      composeShareText({ audienceLabel: 'Bus 2', body: '  Bus leaves at 8:15 from the lobby.  ', sender: 'Test Tour Manager', tripLabel: 'JC-TEST-001 Bali' })
    ).toBe('JC-TEST-001 Bali · To Bus 2\n\nBus leaves at 8:15 from the lobby.\n\nTest Tour Manager, Citius tour manager');
  });

  it('keeps a recipient snapshot and an acknowledgement checklist kept by the tour manager', () => {
    let announcement = createAnnouncement({ audience: { batchId: 'tb_1', kind: 'batch' }, body: 'Lunch at 1', id: 'a1', now: 5, pack });
    expect(announcement.audienceLabel).toBe('Bus 1');
    expect(ackSummary(announcement)).toEqual({ acknowledged: 0, pendingIds: ['t_2', 't_1'], total: 2 });
    announcement = toggleAck(announcement, 't_1');
    expect(ackSummary(announcement)).toEqual({ acknowledged: 1, pendingIds: ['t_2'], total: 2 });
    announcement = toggleAck(announcement, 't_1');
    expect(ackSummary(announcement).acknowledged).toBe(0);
    expect(toggleAck(announcement, 'not_a_recipient')).toBe(announcement);
  });
});
