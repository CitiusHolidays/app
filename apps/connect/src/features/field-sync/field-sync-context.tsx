import { staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { AppState } from 'react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from 'react';

import { useStaffSession } from '@/features/gate/session';
import { useAppStore, useStoredValue } from '@/lib/app-store';
import { logEvent } from '@/lib/safe-log';

import {
  dueSyncItems,
  enqueuePush,
  type FieldPush,
  fieldOutboxKey,
  retrySyncNow,
  sendItem,
  settleItem,
  type SyncDeps,
  type SyncItem,
} from './queue';

interface FieldSyncValue {
  /** Queues the latest state of a stop or announcement for the office; sends when it can. */
  enqueue: (push: FieldPush) => void;
  /** The signed-in staff member's queued and synced pushes. */
  items: SyncItem[];
  retry: (keys: string[]) => void;
}

const FieldSyncContext = createContext<FieldSyncValue | null>(null);
const RUN_INTERVAL_MS = 30_000;

/**
 * Sends headcount stops and announcements to the office, like the expense outbox: saved on the
 * phone first, sent when online, retried with backoff, and only by the staff member who made them.
 */
export function FieldSyncProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { gate, online } = useStaffSession();
  const { live } = useAppStore();
  const canSend = online && gate.kind === 'staff' && !gate.offline;
  const staffId = gate.kind === 'staff' ? gate.staff.staffId : null;
  const [items, setItems, loaded] = useStoredValue<SyncItem[]>(fieldOutboxKey, []);
  const running = useRef(false);
  const again = useRef(false);

  const run = useCallback(async () => {
    if (!canSend || !loaded || !staffId) {
      return;
    }
    if (running.current) {
      // Something changed during this run; look again before stopping.
      again.current = true;
      return;
    }
    running.current = true;
    // Sign-out or a change of user wipes the store; this run must not write items back after it.
    const current = live.fence();
    const deps: SyncDeps = {
      now: () => Date.now(),
      push: (push) =>
        push.kind === 'headcountStop'
          ? convex.mutation(staffApi.pushHeadcountStop.ref, push.args)
          : convex.mutation(staffApi.recordAnnouncement.ref, push.args),
    };
    // Read straight from the live store: it already holds every change made during this run.
    const queued = () => (live.snapshot(fieldOutboxKey)?.value as SyncItem[] | null | undefined) ?? [];
    try {
      do {
        again.current = false;
        for (const item of dueSyncItems(queued(), Date.now(), staffId)) {
          if (!current()) return;
          const outcome = await sendItem(item, deps);
          if (!current()) return;
          await setItems((previous) =>
            previous.map((candidate) =>
              candidate.key === item.key && candidate.staffId === item.staffId ? settleItem(candidate, item, outcome) : candidate
            )
          );
          if (outcome.kind === 'retry') logEvent('field-sync.retry-scheduled');
          if (outcome.kind === 'refused') logEvent('field-sync.refused');
        }
      } while (again.current && current());
    } catch (error) {
      logEvent('field-sync.run-failed', error);
    } finally {
      running.current = false;
    }
  }, [canSend, convex, live, loaded, setItems, staffId]);

  useEffect(() => {
    if (!canSend) {
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
  }, [canSend, run]);

  const value: FieldSyncValue = {
    enqueue: (push) => {
      if (!staffId) return;
      void setItems((previous) => enqueuePush(previous, push, staffId, Date.now()));
      void Promise.resolve().then(run);
    },
    items: items.filter((item) => item.staffId === staffId),
    retry: (keys) => {
      const now = Date.now();
      void setItems((previous) =>
        previous.map((item) => (item.staffId === staffId && keys.includes(item.key) ? retrySyncNow(item, now) : item))
      );
      void Promise.resolve().then(run);
    },
  };
  return <FieldSyncContext.Provider value={value}>{children}</FieldSyncContext.Provider>;
}

export function useFieldSync() {
  const value = useContext(FieldSyncContext);
  if (!value) {
    throw new Error('useFieldSync needs FieldSyncProvider');
  }
  return value;
}
