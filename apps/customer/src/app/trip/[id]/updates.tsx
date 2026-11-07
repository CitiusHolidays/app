import { useLocalSearchParams } from 'expo-router';
import { Text } from '@citius/ui';

import { ListCard, Placeholder, Screen } from '@/components/kit';
import { AnnouncementItem } from '@/components/trip-sections';
import { useTrip } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import { useNow } from '@/lib/use-now';

/** Every message the tour managers sent to this traveller (or their children), newest first. */
export default function TripUpdates() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const now = useNow();
  const items = trip.data?.announcements ?? [];
  return (
    <Screen contentInsetAdjustmentBehavior="automatic" tabBar={false}>
      {trip.loading ? <Placeholder label={t('common.loading')} /> : null}
      {!trip.loading && items.length === 0 ? <Text tone="muted">{t('trip.noUpdates')}</Text> : null}
      {items.length ? (
        <ListCard>
          {items.map((item, index) => (
            <AnnouncementItem announcement={item} key={item.id} last={index === items.length - 1} now={now} />
          ))}
        </ListCard>
      ) : null}
    </Screen>
  );
}
