import { useEffect, useMemo } from 'react';
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * The customer app's motion scale (emil-design-eng, transitions.dev tokens). Everything moves
 * with transform and opacity only, on the UI thread, and reduced motion keeps the fades and drops
 * the travel.
 */
/** Strong ease-out: anything arriving or leaving. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** A small overshoot, for entrances of rare moments only (a success badge). Never on a close. */
const EASE_POP = Easing.bezier(0.34, 1.36, 0.64, 1);
export const MOTION = {
  /** Per-item stagger; keep the total under ~300ms. */
  stagger: 40,
  /** Text and small surface swaps. */
  quick: 150,
  /** Content arriving, steps changing. */
  fast: 250,
  /** Rare moments: a success badge, a reveal. */
  emphasis: 500,
  /** Travel for content rising into place. */
  rise: 8,
} as const;

/** A mark or a small surface appearing in place: opacity only. */
export const FADE_IN = FadeIn.duration(MOTION.quick).easing(EASE_OUT);

/** A line of text swapping in place (transitions.dev text swap: 4pt, 150ms). */
export const TEXT_SWAP_IN = FadeInDown.duration(MOTION.quick).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 4 }] });

/** The next step of a flow taking the place of the last (transitions.dev page slide: 8pt, 250ms). */
export const STEP_IN = FadeInRight.duration(MOTION.fast).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: MOTION.rise }] });

/**
 * The layout animation for the `index`-th item of a short, non-recycled group arriving together
 * (a message screen's lines, a success checklist): an 8pt blurless rise, staggered 40ms.
 * Reanimated skips it under reduced motion.
 */
export function useRiseIn(index: number, delay = 0) {
  return useMemo(
    () =>
      FadeInDown.duration(320)
        .delay(delay + index * MOTION.stagger)
        .easing(EASE_OUT)
        .withInitialValues({ transform: [{ translateY: MOTION.rise }] }),
    [delay, index]
  );
}

/**
 * A rare, earned moment arriving (a success badge, an empty state's mark): it pops from 85% with a
 * slight overshoot and turns upright. Reduced motion: it fades in.
 */
export function usePop(delay = 0, duration: number = MOTION.emphasis) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      progress.set(withTiming(1, { duration, easing: reduced ? EASE_OUT : EASE_POP }));
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, duration, progress, reduced]);
  return useAnimatedStyle(() => {
    const p = progress.get();
    if (reduced) return { opacity: Math.min(1, p) };
    return {
      opacity: Math.min(1, p * 1.6),
      transform: [{ scale: 0.85 + 0.15 * p }, { rotate: `${(1 - p) * -14}deg` }],
    };
  });
}
