import { useFieldSync } from '@/features/field-sync/field-sync-context';
import { announcementPush } from '@/features/field-sync/pushes';
import { useStoredValue } from '@/lib/app-store';

import { type Announcement, announcementsKey, toggleAck } from './announcements';

/**
 * The local log of announcements shared for one trip, newest first. Each share and each change
 * to the seen-by checklist is also queued for the office.
 */
export function useAnnouncements(jobCardId: string | null) {
  const [log, setLog, loaded] = useStoredValue<Announcement[]>(jobCardId ? announcementsKey(jobCardId) : null, []);
  const { enqueue } = useFieldSync();
  return {
    add: (announcement: Announcement) => {
      void setLog((previous) => [announcement, ...previous]);
      enqueue(announcementPush(announcement));
    },
    loaded,
    log,
    toggleAck: (announcementId: string, travellerId: string) => {
      const item = log.find((candidate) => candidate.id === announcementId);
      const next = item && toggleAck(item, travellerId, Date.now());
      if (!next || next === item) return;
      void setLog((previous) => previous.map((candidate) => (candidate.id === announcementId ? next : candidate)));
      enqueue(announcementPush(next));
    },
  };
}
