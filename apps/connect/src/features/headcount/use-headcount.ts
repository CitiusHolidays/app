import { useStoredValue } from '@/lib/app-store';
import { useNow } from '@/lib/use-now';

import { type HeadcountState, headcountKey, localDay, newStop, startHeadcount, togglePresent } from './headcount';

/**
 * Today's headcount for one trip, kept on this phone and shared by every screen. "Today" follows
 * the clock: past midnight the next tap starts a new day's record, even if the screen stayed open.
 */
export function useHeadcount(jobCardId: string | null) {
  const now = useNow();
  const day = localDay(now);
  const key = jobCardId ? headcountKey(jobCardId, day) : null;
  const [stored, setStored, loaded] = useStoredValue<HeadcountState | null>(key, null);
  const state = stored ?? (jobCardId ? startHeadcount(jobCardId, now) : null);
  return {
    loaded,
    newStop: (label: string) => {
      if (state) void setStored(newStop(state, label, Date.now()));
    },
    state,
    toggle: (travellerId: string) => {
      if (state) void setStored(togglePresent(state, travellerId));
    },
  };
}
