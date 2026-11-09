import { type JobCardRow, staffApi } from '@citius/backend';
import { useQueries, useQuery } from 'convex/react';

import { refusalData } from '@/lib/refusal';

/**
 * The record a notification points at, for the short summary on its detail screen: `undefined`
 * while loading, `null` when the server will not show it to this tour manager. A Job Card whose
 * trip is not live in the app (`APP_PILOT_OFF`) counts as not shown; any other failure still
 * reaches the error screen.
 */
export function useJobCardSummary(jobCardId: string): JobCardRow | null | undefined {
  const { job } = useQueries({ job: { args: { jobCardId, surface: 'connect' }, query: staffApi.getJobCardDetail.ref } });
  if (job instanceof Error) {
    if (refusalData(job) === 'APP_PILOT_OFF') return null;
    throw job;
  }
  return job as JobCardRow | null | undefined;
}

/** See `useJobCardSummary`. */
export function useExpenseSummary(expenseId: string) {
  return useQuery(staffApi.getExpenseRow.ref, { expenseId });
}
