import type { AnnouncementArgs } from '@citius/backend';

import type { Announcement } from '@/features/announcements/announcements';
import type { HeadcountState, HeadcountStop } from '@/features/headcount/headcount';

import type { FieldPush } from './queue';

/**
 * One stop as the office records it. No `travelBatchId`: a stop is one count of the whole group
 * (the batch chips only filter the list), so the office counts it against the whole group too.
 */
export function headcountStopPush(state: HeadcountState, stop: HeadcountStop): FieldPush {
  return {
    args: {
      clientStopId: stop.id,
      clientUpdatedAt: stop.updatedAt ?? stop.startedAt,
      day: state.day,
      jobCardId: state.jobCardId,
      label: stop.label,
      presentTravellerIds: [...stop.present],
      startedAt: stop.startedAt,
    },
    kind: 'headcountStop',
  };
}

/**
 * The announcement and its checklist. A batch audience is sent as that batch; "your group" is
 * sent as the whole trip, which the server keeps only when the tour manager has the whole Job Card
 * and everyone travelling received it (then trip organizers see it in the customer app).
 */
export function announcementPush(announcement: Announcement): FieldPush {
  const recipients = new Set(announcement.recipientIds);
  const args: AnnouncementArgs = {
    body: announcement.body,
    clientAnnouncementId: announcement.id,
    clientUpdatedAt: announcement.updatedAt ?? announcement.sharedAt,
    jobCardId: announcement.jobCardId,
    recipientTravellerIds: [...announcement.recipientIds],
    seenByTravellerIds: announcement.acknowledgedIds.filter((id) => recipients.has(id)),
    sharedAt: announcement.sharedAt,
  };
  return {
    args:
      announcement.audience.kind === 'batch'
        ? { ...args, travelBatchId: announcement.audience.batchId }
        : { ...args, audience: 'trip' },
    kind: 'announcement',
  };
}
