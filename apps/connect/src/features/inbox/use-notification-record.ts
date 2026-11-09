import { staffApi } from '@citius/backend';
import { useQuery } from 'convex/react';

/**
 * The record a notification points at, for the short summary on its detail screen: `undefined`
 * while loading, `null` when the server will not show it to this tour manager.
 */
export function useJobCardSummary(jobCardId: string) {
  return useQuery(staffApi.getJobCardDetail.ref, { jobCardId, surface: 'connect' });
}

/** See `useJobCardSummary`. */
export function useExpenseSummary(expenseId: string) {
  return useQuery(staffApi.getExpenseRow.ref, { expenseId });
}
