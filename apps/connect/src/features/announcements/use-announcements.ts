import { useStoredValue } from '@/lib/app-store';

import { type Announcement, announcementsKey, toggleAck } from './announcements';

/** The local log of announcements shared for one trip, newest first. */
export function useAnnouncements(jobCardId: string | null) {
  const [log, setLog, loaded] = useStoredValue<Announcement[]>(jobCardId ? announcementsKey(jobCardId) : null, []);
  return {
    add: (announcement: Announcement) => setLog((previous) => [announcement, ...previous]),
    loaded,
    log,
    toggleAck: (announcementId: string, travellerId: string) =>
      setLog((previous) => previous.map((item) => (item.id === announcementId ? toggleAck(item, travellerId) : item))),
  };
}
