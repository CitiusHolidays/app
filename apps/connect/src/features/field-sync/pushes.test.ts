import { createAnnouncement, toggleAck } from '@/features/announcements/announcements';
import { newStop, startHeadcount, togglePresent } from '@/features/headcount/headcount';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';

import { announcementPush, headcountStopPush } from './pushes';
import { syncKey } from './queue';

const MORNING = new Date(2026, 10, 6, 7, 0).getTime();
const pack = buildTripPack({ batches, commandCenter, complete: true, savedAt: 0, tourManagers, travellers });

describe('field sync pushes', () => {
  it('sends a stop with a stable id, its local day and the local update time', () => {
    let state = startHeadcount('jc_1', MORNING);
    state = togglePresent(state, 't_1', MORNING + 5_000);
    const [stop] = state.stops;
    if (!stop) throw new Error('no stop');
    const push = headcountStopPush(state, stop);
    expect(push).toEqual({
      args: {
        clientStopId: `stop-${MORNING}`,
        clientUpdatedAt: MORNING + 5_000,
        day: '2026-11-06',
        jobCardId: 'jc_1',
        label: 'Start of day',
        presentTravellerIds: ['t_1'],
        startedAt: MORNING,
      },
      kind: 'headcountStop',
    });
    expect(push.args).not.toHaveProperty('travelBatchId');
    expect(/^[A-Za-z0-9._:-]{1,128}$/.test(stop.id)).toBe(true);

    // Later marks keep the id; a new stop gets its own.
    const later = togglePresent(state, 't_2', MORNING + 9_000);
    expect(syncKey(headcountStopPush(later, later.stops[0] ?? stop))).toBe(syncKey(push));
    const next = newStop(later, 'Lunch', MORNING + 60_000);
    expect(next.stops[1]?.id).not.toBe(stop.id);
  });

  it('sends an announcement with its audience, recipients and who has seen it', () => {
    let announcement = createAnnouncement({ audience: { batchId: 'tb_1', kind: 'batch' }, body: 'Lunch at 1', id: 'ann_1', now: 50, pack });
    announcement = toggleAck(announcement, 't_1', 70);
    expect(announcementPush(announcement)).toEqual({
      args: {
        body: 'Lunch at 1',
        clientAnnouncementId: 'ann_1',
        clientUpdatedAt: 70,
        jobCardId: 'jc_test_1',
        recipientTravellerIds: ['t_2', 't_1'],
        seenByTravellerIds: ['t_1'],
        sharedAt: 50,
        travelBatchId: 'tb_1',
      },
      kind: 'announcement',
    });
    const group = createAnnouncement({ audience: { kind: 'trip' }, body: 'Hi', id: 'ann_2', now: 50, pack });
    expect(announcementPush(group).args).not.toHaveProperty('travelBatchId');
  });
});
