import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a just-marked row stays in a "Not marked" list, showing its new state, before it leaves. */
export const LINGER_MS = 650;

/**
 * Ids that should stay visible for a moment after they stop matching a filter, so a change confirms
 * itself where the person tapped instead of the row vanishing from under their finger. `hold(id)`
 * keeps one for `ms`; each new hold restarts that id's timer. Timers clear on unmount.
 */
export function useLingering(ms = LINGER_MS) {
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const hold = useCallback(
    (id: string) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      setHeld((current) => new Set(current).add(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setHeld((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }, ms)
      );
    },
    [ms]
  );

  return { hold, held };
}
