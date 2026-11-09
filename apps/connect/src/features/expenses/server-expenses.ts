import { type ExpenseRow, type PaginationResult, staffApi } from '@citius/backend';
import { useQuery } from 'convex/react';

import { useStaffSession } from '@/features/gate/session';

/** How many of the trip's expenses the tab reads from the server. */
export const SERVER_PAGE_SIZE = 50;

/** What the server holds for the trip, or why the tab cannot show it. */
export type ServerExpenses =
  | { kind: 'noTrip' }
  | { kind: 'offline' }
  | { kind: 'loading' }
  /** `complete` is false when the trip has more expenses than the one page read. */
  | { complete: boolean; kind: 'loaded'; rows: ExpenseRow[] };

export function serverExpenses(input: {
  canQuery: boolean;
  hasTrip: boolean;
  result: Pick<PaginationResult<ExpenseRow>, 'isDone' | 'page'> | undefined;
}): ServerExpenses {
  if (!input.hasTrip) return { kind: 'noTrip' };
  if (!input.canQuery) return { kind: 'offline' };
  if (!input.result) return { kind: 'loading' };
  return { complete: input.result.isDone, kind: 'loaded', rows: input.result.page };
}

/** The first page of the trip's expenses on the server; nothing is asked while offline. */
export function useServerExpenses(jobCardId: string | null): ServerExpenses {
  const { gate, online } = useStaffSession();
  const canQuery = online && gate.kind === 'staff' && !gate.offline;
  const result = useQuery(
    staffApi.listExpenses.ref,
    canQuery && jobCardId ? { jobCardId, paginationOpts: { cursor: null, numItems: SERVER_PAGE_SIZE } } : 'skip'
  );
  return serverExpenses({ canQuery, hasTrip: jobCardId !== null, result: canQuery ? result : undefined });
}
