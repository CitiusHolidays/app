import { useEffect } from 'react';
import { AppState } from 'react-native';

const RUN_INTERVAL_MS = 30_000;

/**
 * Runs a send queue while `enabled`: once straight away, every 30 s, and whenever the app comes
 * back to the foreground. Shared by the expense outbox and the field sync queue.
 */
export function useBackgroundRun(enabled: boolean, run: () => Promise<void>) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    void Promise.resolve().then(run);
    const timer = setInterval(() => void run(), RUN_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled, run]);
}
