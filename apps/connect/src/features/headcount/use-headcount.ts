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
  // Until today's record is read, `state` is a fresh start for display only.
  const state = stored ?? (jobCardId ? startHeadcount(jobCardId, now) : null);
  /**
   * Saves the change and returns the new state, so the caller can send the changed stop to the
   * office. Before today's record is read nothing is saved: a fresh start would overwrite it.
   */
  const save = (change: (current: HeadcountState) => HeadcountState) => {
    if (!loaded || !state) return null;
    const next = change(state);
    void setStored(next);
    return next;
  };
  return {
    loaded,
    newStop: (label: string) => save((current) => newStop(current, label, Date.now())),
    state,
    toggle: (travellerId: string) => save((current) => togglePresent(current, travellerId, Date.now())),
  };
}
