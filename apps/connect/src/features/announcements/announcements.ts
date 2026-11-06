import type { RosterEntry, TripPack } from '@/features/trip-pack/trip-pack';

export type Audience = { kind: 'trip' } | { batchId: string; kind: 'batch' };

export interface Announcement {
  acknowledgedIds: string[];
  audience: Audience;
  audienceLabel: string;
  body: string;
  id: string;
  jobCardId: string;
  /** Who it was for when it was shared; the checklist does not change if the roster does. */
  recipientIds: string[];
  sharedAt: number;
  /** When the checklist last changed on the phone; the office keeps the latest. Older entries lack it. */
  updatedAt?: number;
}

export const announcementsKey = (jobCardId: string) => `announcements:${jobCardId}`;

export function audienceLabel(pack: TripPack, audience: Audience) {
  if (audience.kind === 'trip') {
    // The roster is the tour manager's own group (the server narrows it), not the whole Job Card.
    return 'your group';
  }
  return pack.batches.find((batch) => batch.id === audience.batchId)?.label ?? 'Travel batch';
}

export function recipientsFor(pack: TripPack, audience: Audience): RosterEntry[] {
  return pack.roster.filter(
    (entry) => entry.travelling && (audience.kind === 'trip' || entry.batchId === audience.batchId)
  );
}

export function composeShareText(input: { audienceLabel: string; body: string; sender: string; tripLabel: string }) {
  return `${input.tripLabel} · To ${input.audienceLabel}\n\n${input.body.trim()}\n\n${input.sender}, Citius tour manager`;
}

export function createAnnouncement(input: {
  audience: Audience;
  body: string;
  id: string;
  now: number;
  pack: TripPack;
}): Announcement {
  return {
    acknowledgedIds: [],
    audience: input.audience,
    audienceLabel: audienceLabel(input.pack, input.audience),
    body: input.body.trim(),
    id: input.id,
    jobCardId: input.pack.jobCardId,
    recipientIds: recipientsFor(input.pack, input.audience).map((entry) => entry.id),
    sharedAt: input.now,
    updatedAt: input.now,
  };
}

export function toggleAck(announcement: Announcement, travellerId: string, now?: number): Announcement {
  if (!announcement.recipientIds.includes(travellerId)) {
    return announcement;
  }
  const acknowledgedIds = announcement.acknowledgedIds.includes(travellerId)
    ? announcement.acknowledgedIds.filter((id) => id !== travellerId)
    : [...announcement.acknowledgedIds, travellerId];
  return now === undefined ? { ...announcement, acknowledgedIds } : { ...announcement, acknowledgedIds, updatedAt: now };
}

export function ackSummary(announcement: Announcement) {
  const acknowledged = new Set(announcement.acknowledgedIds);
  const pendingIds = announcement.recipientIds.filter((id) => !acknowledged.has(id));
  return { acknowledged: announcement.recipientIds.length - pendingIds.length, pendingIds, total: announcement.recipientIds.length };
}
