import { customerApi } from '@citius/backend/customer';
import { useQuery } from 'convex/react';

import { useCachedAnswer } from '@/features/data/use-cached-query';
import { useCustomerSession } from '@/features/session/session';

import { useReferenceNow } from './reference-now';

/** The traveller's trips: saved on the phone, refreshed live. */
export function useTrips() {
  const { live } = useCustomerSession();
  const referenceNow = useReferenceNow();
  const answer = useQuery(customerApi.listMyTrips.ref, live ? { referenceNow } : 'skip');
  return useCachedAnswer('trips:list', answer, live);
}

/** One trip's detail: saved on the phone, refreshed live. Null when it is not (or no longer) open. */
export function useTrip(tripId: string | undefined) {
  const { live } = useCustomerSession();
  const referenceNow = useReferenceNow();
  const asking = live && tripId !== undefined;
  const answer = useQuery(customerApi.getMyTrip.ref, asking ? { referenceNow, tripId } : 'skip');
  return useCachedAnswer(tripId ? `trips:detail:${tripId}` : null, answer, asking);
}
