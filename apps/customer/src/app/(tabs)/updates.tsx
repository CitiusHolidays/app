import type { TripSummary } from '@citius/backend/customer';
import { space, Text } from '@citius/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { ListCard, PageTitle, Placeholder, QuietState, Screen, SectionTitle } from '@/components/kit';
import { tripDates } from '@/components/trip-cards';
import { AnnouncementItem } from '@/components/trip-sections';
import { splitTrips } from '@/features/trips/model';
import { useTrip, useTrips } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import { useNow } from '@/lib/use-now';

/** At most this many trips feed the tab: the ones under way or coming up. */
const MAX_TRIPS = 4;

function TripUpdates({ now, trip }: { now: number; trip: TripSummary }) {
  const i18n = useI18n();
  const detail = useTrip(trip.tripId);
  const items = detail.data?.announcements.slice(0, 5) ?? [];
  if (!detail.loading && items.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle
        action={{ label: i18n.t('common.seeAll'), onPress: () => router.push({ params: { id: trip.tripId }, pathname: '/trip/[id]/updates' }) }}
      >
        {trip.destination}
      </SectionTitle>
      <Text tone="muted" variant="label">
        {tripDates(i18n, trip)}
      </Text>
      <ListCard>
        {detail.loading ? <Placeholder label={i18n.t('common.loading')} lines={2} /> : null}
        {items.map((item, index) => (
          <AnnouncementItem announcement={item} key={item.id} last={index === items.length - 1} now={now} />
        ))}
      </ListCard>
    </View>
  );
}

/** Messages from tour managers on the trips under way or coming up. */
export default function Updates() {
  const { t } = useI18n();
  const trips = useTrips();
  const now = useNow();
  const { active } = splitTrips(trips.data ?? []);
  const shown = active.slice(0, MAX_TRIPS);
  return (
    <Screen header={<PageTitle title={t('updates.title')} />}>
      {trips.loading ? <Placeholder label={t('common.loading')} /> : null}
      {!trips.loading && shown.length === 0 ? <QuietState text={t('updates.empty')} /> : null}
      {shown.map((trip) => (
        <TripUpdates key={trip.tripId} now={now} trip={trip} />
      ))}
    </Screen>
  );
}
