import { staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { createContext, type ReactNode, useCallback, useContext } from 'react';

import { canReachServer } from '@/features/gate/reach';
import { useStaffSession } from '@/features/gate/session';
import { useAppStore, useStoredValue } from '@/lib/app-store';
import { logEvent } from '@/lib/safe-log';
import { useSerialRun } from '@/lib/serial-runner';
import { useBackgroundRun } from '@/lib/use-background-run';

import {
  discardRefused,
  drainSyncQueue,
  enqueuePush,
  type FieldPush,
  fieldOutboxKey,
  readSyncItems,
  retrySyncNow,
  settleItem,
  type StoredSyncItem,
  type SyncDeps,
  type SyncItem,
} from './queue';

interface FieldSyncValue {
  /** Stops sending refused items: the record stays on the phone, and a later change queues it again. */
  discard: (keys: string[]) => void;
  /** Queues the latest state of a stop or announcement for the office; sends when it can. */
  enqueue: (push: FieldPush) => void;
  /** The signed-in staff member's queued and synced pushes. */
  items: SyncItem[];
  retry: (keys: string[]) => void;
}

const FieldSyncContext = createContext<FieldSyncValue | null>(null);

/**
 * Sends headcount stops and announcements to the office, like the expense outbox: saved on the
 * phone first, sent when online, retried with backoff, and only by the staff member who made them.
 */
export function FieldSyncProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { gate, online } = useStaffSession();
  const { live } = useAppStore();
  const canSend = canReachServer(gate, online);
  const staffId = gate.kind === 'staff' ? gate.staff.staffId : null;
  const [stored, setStored, loaded] = useStoredValue<StoredSyncItem[]>(fieldOutboxKey, []);
  const items = readSyncItems(stored);
  /** Every change reads through `readSyncItems`, so items saved by an earlier version are converted. */
  const update = useCallback(
    (change: (previous: SyncItem[]) => SyncItem[]) => setStored((previous) => change(readSyncItems(previous))),
    [setStored]
  );

  const send = useCallback(async () => {
    if (!canSend || !loaded || !staffId) {
      return;
    }
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
    const queued = () => readSyncItems(live.snapshot(fieldOutboxKey)?.value as StoredSyncItem[] | null | undefined);
    await drainSyncQueue({
      deps,
      isCurrent: current,
      queued,
      settle: async (sent, outcome) => {
        await update((previous) =>
          previous.map((candidate) =>
            candidate.key === sent.key && candidate.staffId === sent.staffId ? settleItem(candidate, sent, outcome) : candidate
          )
        );
        if (outcome.kind === 'retry') logEvent('field-sync.retry-scheduled');
        if (outcome.kind === 'refused') logEvent('field-sync.refused');
      },
      staffId,
    });
  }, [canSend, convex, live, loaded, staffId, update]);
  // One run at a time; a change made during a run gets one more run as soon as it ends.
  const run = useSerialRun(send, (error) => logEvent('field-sync.run-failed', error));

  useBackgroundRun(canSend, run);

  const value: FieldSyncValue = {
    discard: (keys) => {
      if (!staffId) return;
      void update((previous) => discardRefused(previous, keys, staffId));
      logEvent('field-sync.discarded');
    },
    enqueue: (push) => {
      if (!staffId) return;
      void update((previous) => enqueuePush(previous, push, staffId, Date.now()));
      void Promise.resolve().then(run);
    },
    items: items.filter((item) => item.staffId === staffId),
    retry: (keys) => {
      const now = Date.now();
      const retried = new Set(keys);
      void update((previous) =>
        previous.map((item) => (item.staffId === staffId && retried.has(item.key) ? retrySyncNow(item, now) : item))
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
