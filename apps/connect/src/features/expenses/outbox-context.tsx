import { staffApi } from '@citius/backend';
import { useConvex } from 'convex/react';
import { AppState } from 'react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from 'react';

import { useStaffSession } from '@/features/gate/session';
import { useStoredValue } from '@/lib/app-store';
import { logEvent } from '@/lib/safe-log';

import { dueItems, type OutboxDeps, type OutboxItem, outboxKey, processItem, retryNow } from './outbox';
import { deleteReceipt, uploadReceipt } from './receipt-files';

interface OutboxValue {
  discard: (id: string) => void;
  enqueue: (item: OutboxItem) => void;
  items: OutboxItem[];
  retry: (id: string) => void;
  runNow: () => void;
}

const OutboxContext = createContext<OutboxValue | null>(null);
const RUN_INTERVAL_MS = 30_000;
const KEEP_DONE_MS = 3 * 24 * 60 * 60 * 1000;

function replace(items: OutboxItem[], next: OutboxItem) {
  return items.map((item) => (item.id === next.id ? next : item));
}

export function OutboxProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { gate, online } = useStaffSession();
  const canSend = online && gate.kind === 'staff' && !gate.offline;
  const [items, setItems, loaded] = useStoredValue<OutboxItem[]>(outboxKey, []);
  const itemsRef = useRef(items);
  const running = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const run = useCallback(async () => {
    if (running.current || !canSend || !loaded) {
      return;
    }
    running.current = true;
    const save = async (item: OutboxItem) => setItems((previous) => replace(previous, item));
    const deps: OutboxDeps = {
      attachProof: async (args) => {
        await convex.action(staffApi.attachExpenseProof.ref, args);
      },
      createExpense: async (args) => (await convex.mutation(staffApi.createExpense.ref, args)).id,
      findExpenseByRef: async (jobCardId, ref) => {
        const page = await convex.query(staffApi.listExpenses.ref, { jobCardId, paginationOpts: { cursor: null, numItems: 100 } });
        return page.page.find((row) => row.notes === ref)?.id ?? null;
      },
      generateUploadUrl: (expenseId) => convex.action(staffApi.generateExpenseUploadUrl.ref, { expenseId }),
      now: () => Date.now(),
      save,
      submitExpense: async (expenseId) => {
        await convex.mutation(staffApi.submitExpense.ref, { expenseId });
      },
      uploadReceipt,
    };
    try {
      for (const item of dueItems(itemsRef.current, Date.now())) {
        const result = await processItem(item, deps);
        await save(result);
        if (result.status === 'done') {
          deleteReceipt(result.receipt);
        }
        if (result.status === 'pending') {
          logEvent('outbox.retry-scheduled');
        }
      }
    } catch (error) {
      logEvent('outbox.run-failed', error);
    } finally {
      running.current = false;
    }
  }, [canSend, convex, loaded, setItems]);

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

  const value: OutboxValue = {
    discard: (id) => {
      const item = itemsRef.current.find((candidate) => candidate.id === id);
      if (item) deleteReceipt(item.receipt);
      setItems((previous) => previous.filter((candidate) => candidate.id !== id));
    },
    enqueue: (item) => {
      itemsRef.current = [...itemsRef.current, item];
      setItems((previous) => [...previous.filter((old) => !(old.status === 'done' && Date.now() - old.updatedAt > KEEP_DONE_MS)), item]);
      void Promise.resolve().then(run);
    },
    items,
    retry: (id) => {
      itemsRef.current = itemsRef.current.map((item) => (item.id === id ? retryNow(item, Date.now()) : item));
      setItems((previous) => previous.map((item) => (item.id === id ? retryNow(item, Date.now()) : item)));
      void Promise.resolve().then(run);
    },
    runNow: () => void run(),
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
