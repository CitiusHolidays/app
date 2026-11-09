import { Banner, Surface, Text } from '@citius/ui';

import { QuietState } from '@/components/kit';

import { NO_TRIPS, NO_TRIPS_OFFLINE, TRIPS_LOAD_FAILED } from './trips-list';
import { useTrips } from './trips-context';

/**
 * Why there are no trips to show (none assigned, offline before the first download, or the
 * download failed), or that the list is only partly loaded. Nothing while the list is still
 * coming: the screens hold its place with skeletons instead.
 */
export function TripsStatus() {
  const { tripsComplete, tripsStatus } = useTrips();
  switch (tripsStatus.kind) {
    case 'reading':
    case 'loading':
      return null;
    case 'offline':
      return (
        <Surface>
          <QuietState text={NO_TRIPS_OFFLINE} />
        </Surface>
      );
    case 'failed':
      return (
        <Banner tone="attention">
          <Text variant="secondary">{TRIPS_LOAD_FAILED}</Text>
        </Banner>
      );
    case 'empty':
      return (
        <Surface>
          <QuietState text={NO_TRIPS} />
        </Surface>
      );
    case 'ready':
      return tripsComplete ? null : (
        <Banner tone="attention">
          <Text variant="secondary">Not every trip could be loaded, so some of yours may be missing here. Pull down to try again.</Text>
        </Banner>
      );
  }
}
