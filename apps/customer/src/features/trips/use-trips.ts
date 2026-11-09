import { customerApi } from '@citius/backend/customer';

import { useCustomerSession } from '@/features/session/session';
import { useCachedQuery } from '@/features/data/use-cached-query';

import { useReferenceNow } from './reference-now';

/** The traveller's trips: saved on the phone, refreshed live. */
export function useTrips() {
  const { live } = useCustomerSession();
  const referenceNow = useReferenceNow();
  return useCachedQuery('trips:list', customerApi.listMyTrips.ref, live ? { referenceNow } : 'skip');
}

/** One trip's detail: saved on the phone, refreshed live. Null when it is not (or no longer) open. */
export function useTrip(tripId: string | undefined) {
  const { live } = useCustomerSession();
  const referenceNow = useReferenceNow();
  return useCachedQuery(tripId ? `trips:detail:${tripId}` : null, customerApi.getMyTrip.ref, live && tripId ? { referenceNow, tripId } : 'skip');
}
