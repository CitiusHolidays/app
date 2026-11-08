import { useEffect } from 'react';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

/** Strong ease-out for anything arriving or leaving. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const RISE_PT = 12;
const ENTER_MS = 420;

/**
 * A screen's content arriving once: it fades in and rises a few points the first time it is ready
 * (on launch, as the planes fly off), and never again. With reduced motion it only fades. Apply the
 * style to a list or screen container, never to recycled rows.
 */
export function useEntrance(ready: boolean) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!ready || progress.get() > 0) return;
    progress.set(withTiming(1, { duration: ENTER_MS, easing: EASE_OUT }));
  }, [progress, ready]);
  return useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: reduced ? 0 : (1 - progress.get()) * RISE_PT }],
  }));
}
