import { useEffect, useState } from 'react';

/** Rows drawn with the first frame: about two screens of roster. */
export const FIRST_ROWS = 30;
/** Rows added on each following frame until the list is complete. */
export const ROWS_PER_FRAME = 40;

/**
 * How many rows of a long list to draw right now. The first screens draw at once and the rest
 * follow a frame at a time, so a 300-person roster opens instantly instead of building every row
 * before the first paint, and taps and scrolling stay responsive while it fills in. Every row is
 * drawn within a few frames, so screen readers and scrolling reach the whole list.
 */
export function useProgressiveCount(total: number, first = FIRST_ROWS, step = ROWS_PER_FRAME) {
  const [shown, setShown] = useState(() => Math.min(total, first));

  useEffect(() => {
    if (shown >= total) return;
    const frame = requestAnimationFrame(() => setShown((current) => Math.min(total, Math.max(current, first) + step)));
    return () => cancelAnimationFrame(frame);
  }, [first, shown, step, total]);

  // A longer list (the trip pack refreshed) keeps what is drawn; a shorter one shows all of it.
  return Math.min(total, Math.max(shown, Math.min(total, first)));
}
