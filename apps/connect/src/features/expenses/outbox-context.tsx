import { staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { createContext, type ReactNode, useCallback, useContext } from 'react';

import { canReachServer } from '@/features/gate/reach';
import { useStaffSession } from '@/features/gate/session';
import { collectPages } from '@/features/trips/trips';
import { useAppStore, useStoredValue } from '@/lib/app-store';
import { logEvent } from '@/lib/safe-log';
import { useSerialRun } from '@/lib/serial-runner';
import { useBackgroundRun } from '@/lib/use-background-run';

import { drainOutbox, type OutboxDeps, type OutboxItem, outboxKey, readOutbox, retryNow } from './outbox';
import { deleteReceipt, uploadReceipt } from './receipt-files';

interface OutboxValue {
  discard: (id: string) => void;
  enqueue: (item: OutboxItem) => void;
  items: OutboxItem[];
  retry: (id: string) => void;
}

const OutboxContext = createContext<OutboxValue | null>(null);
/** How far back the duplicate check looks (pages of 100 of the trip's expenses). */
const REF_LOOKUP_PAGES = 5;
const KEEP_DONE_MS = 3 * 24 * 60 * 60 * 1000;

function replace(items: OutboxItem[], next: OutboxItem) {
  return items.map((item) => (item.id === next.id ? next : item));
}

export function OutboxProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { gate, online } = useStaffSession();
  const { live } = useAppStore();
  const canSend = canReachServer(gate, online);
  const staffId = gate.kind === 'staff' ? gate.staff.staffId : null;
  const [saved, setSaved, loaded] = useStoredValue<unknown>(outboxKey, []);
  // Checked as it comes off the disk: everything past this line works with typed items only.
  const items = readOutbox(saved);
  const setItems = useCallback(
    (update: (previous: OutboxItem[]) => OutboxItem[]) => setSaved((previous: unknown) => update(readOutbox(previous))),
    [setSaved]
  );
  /** The queue as it is now: the live store holds every change, including one made a moment ago. */
  const queued = useCallback(() => readOutbox(live.snapshot(outboxKey)?.value), [live]);

  const send = useCallback(async () => {
    if (!canSend || !loaded || !staffId) {
      return;
    }
    // Sign-out or a change of user wipes the store; this run must not write items back after it.
    const current = live.fence();
    const save = async (item: OutboxItem) => {
      if (!current()) {
        // Stops processItem before its next request: the item no longer exists on this phone.
        throw new Error('Outbox was cleared');
      }
      await setItems((previous) => replace(previous, item));
    };
    const deps: OutboxDeps = {
      attachProof: async (args) => {
        await convex.action(staffApi.attachExpenseProof.ref, args);
      },
      createExpense: async (args) => (await convex.mutation(staffApi.createExpense.ref, args)).id,
      findExpenseByRef: async (jobCardId, ref) => {
        const { rows } = await collectPages(
          (cursor) => convex.query(staffApi.listExpenses.ref, { jobCardId, paginationOpts: { cursor, numItems: 100 } }),
          REF_LOOKUP_PAGES
        );
        return rows.find((row) => row.notes === ref)?.id ?? null;
      },
      generateUploadUrl: (expenseId) => convex.action(staffApi.generateExpenseUploadUrl.ref, { expenseId }),
      now: () => Date.now(),
      save,
      submitExpense: async (expenseId) => {
        await convex.mutation(staffApi.submitExpense.ref, { expenseId });
      },
      uploadReceipt,
    };
    await drainOutbox({
      deps,
      isCurrent: current,
      items: queued(),
      onSettled: (result) => {
        if (result.status === 'done') {
          deleteReceipt(result.receipt);
        }
        if (result.status === 'pending') {
          logEvent('outbox.retry-scheduled');
        }
      },
      staffId,
    });
  }, [canSend, convex, live, loaded, queued, setItems, staffId]);
  // One run at a time; an expense added or retried during a run gets one more run as soon as it ends.
  const run = useSerialRun(send, (error) => logEvent('outbox.run-failed', error));

  useBackgroundRun(canSend, run);

  const value: OutboxValue = {
    discard: (id) => {
      const item = queued().find((candidate) => candidate.id === id);
      if (item) deleteReceipt(item.receipt);
      setItems((previous) => previous.filter((candidate) => candidate.id !== id));
    },
    enqueue: (item) => {
      setItems((previous) => [...previous.filter((old) => !(old.status === 'done' && Date.now() - old.updatedAt > KEEP_DONE_MS)), item]);
      void Promise.resolve().then(run);
    },
    items,
    retry: (id) => {
      setItems((previous) => previous.map((item) => (item.id === id ? retryNow(item, Date.now()) : item)));
      void Promise.resolve().then(run);
    },
  };
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox() {
  const value = useContext(OutboxContext);
  if (!value) {
    throw new Error('useOutbox needs OutboxProvider');
  }
  return value;
}
