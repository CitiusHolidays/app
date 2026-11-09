import { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';

/**
 * Connect's motion vocabulary, shared so every screen moves the same way. Curves from Emil
 * Kowalski's UI set; durations stay under 300 ms (animate-expo, improve-animations AUDIT.md).
 */

/** Strong ease-out for entrances and state changes. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** A count rolling to a higher value rises 6pt into place; to a lower one it drops 6pt (160 ms). */
export const ROLL_UP = FadeInUp.duration(160).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 6 }] });
export const ROLL_DOWN = FadeInDown.duration(160).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: -6 }] });
/** Content arriving in place of a placeholder. */
export const ARRIVE = FadeIn.duration(220).easing(EASE_OUT);
/** A notice appearing (open) and leaving (close: faster and quieter than the open). */
export const NOTICE_IN = FadeIn.duration(200).easing(EASE_OUT);
export const NOTICE_OUT = FadeOut.duration(150);
/**
 * A row leaving a list: it fades out quickly (120 ms), and the rows below wait for that (90 ms)
 * before closing the gap over 220 ms, so the next row never slides over the fading one.
 */
export const ROW_OUT = FadeOut.duration(120);
/**
 * Kept on purpose, unchanged: it animates layout on every sibling row (the headcount roster after
 * each mark), so its cost is still to be measured on a low-end Android before it is cut or kept.
 */
export const CLOSE_UP = LinearTransition.duration(220).delay(90).easing(EASE_OUT);

/** Whether a count changing from `before` to `after` went up. "All" counts as the top. */
export function rollsUp(before: string, after: string) {
  if (after === 'All') return true;
  if (before === 'All') return false;
  return Number(after) >= Number(before);
}
