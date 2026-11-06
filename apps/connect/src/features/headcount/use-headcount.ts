import { useState } from 'react';

import { useStoredValue } from '@/lib/app-store';

import { type HeadcountState, headcountKey, localDay, newStop, startHeadcount, togglePresent } from './headcount';

/** Today's headcount for one trip, kept on this phone and shared by every screen. */
export function useHeadcount(jobCardId: string | null) {
  const [today] = useState(() => Date.now());
  const day = localDay(today);
  const key = jobCardId ? headcountKey(jobCardId, day) : null;
  const [stored, setStored, loaded] = useStoredValue<HeadcountState | null>(key, null);
  const state = stored ?? (jobCardId ? startHeadcount(jobCardId, today) : null);
  return {
    loaded,
    newStop: (label: string) => {
      if (state) setStored(newStop(state, label, Date.now()));
    },
    state,
    toggle: (travellerId: string) => {
      if (state) setStored(togglePresent(state, travellerId));
    },
  };
}
