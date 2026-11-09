import type { TripSummary } from '@citius/backend/customer';
import { space, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { FlatList, Platform, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListCard, PageTitle, QuietState, SectionTitle } from '@/components/kit';
import { AnnouncementRows, UpdatesSkeleton } from '@/components/skeletons';
import { tripDates } from '@/features/trips/labels';
import { AnnouncementItem } from '@/components/trip-sections';
import { splitTrips } from '@/features/trips/model';
import { useTrip, useTrips } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import { useNow } from '@/lib/use-now';
import { usePullRefresh } from '@/lib/use-pull-refresh';

/** At most this many trips feed the tab: the ones under way or coming up. */
const MAX_TRIPS = 4;
/** The latest messages shown per trip; "See all" opens the rest. */
const SHOWN_PER_TRIP = 5;

function TripUpdates({ now, trip }: { now: number; trip: TripSummary }) {
  const i18n = useI18n();
  const detail = useTrip(trip.tripId);
  const all = detail.data?.announcements ?? [];
  const items = all.slice(0, SHOWN_PER_TRIP);
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle
        action={
          all.length > items.length
            ? { label: i18n.t('common.seeAll'), onPress: () => router.push({ params: { id: trip.tripId }, pathname: '/trip/[id]/updates' }) }
            : undefined
        }
      >
        {trip.destination}
      </SectionTitle>
      <Text tone="muted" variant="label">
        {tripDates(i18n, trip)}
      </Text>
      <ListCard>
        {detail.loading ? <AnnouncementRows count={2} label={i18n.t('common.loading')} /> : null}
        {!detail.loading && items.length === 0 ? (
          <Text style={{ paddingVertical: space.md }} tone="muted">
            {i18n.t('trip.noUpdates')}
          </Text>
        ) : null}
        {items.map((item, index) => (
          <AnnouncementItem announcement={item} key={item.id} last={index === items.length - 1} now={now} />
        ))}
      </ListCard>
    </View>
  );
}

/** Messages from tour managers on the trips under way or coming up, one virtualised section per trip. */
export default function Updates() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const trips = useTrips();
  const now = useNow();
  const { active } = splitTrips(trips.data ?? []);
  const shown = active.slice(0, MAX_TRIPS);
  const refresh = usePullRefresh(trips.live);
  return (
    <FlatList
      ItemSeparatorComponent={() => <View style={{ height: space.xl }} />}
      ListEmptyComponent={
        trips.loading ? (
          <UpdatesSkeleton label={t('common.loading')} />
        ) : (
          <QuietState text={t('updates.empty')} />
        )
      }
      ListHeaderComponent={
        <View style={{ paddingBottom: space.lg + 4 }}>
          <PageTitle title={t('updates.title')} />
        </View>
      }
      contentContainerStyle={{
        paddingBottom: insets.bottom + 96,
        paddingHorizontal: theme.frame,
        paddingTop: Platform.OS === 'ios' ? space.sm : insets.top + space.md,
      }}
      contentInsetAdjustmentBehavior="automatic"
      data={shown}
      refreshControl={<RefreshControl onRefresh={refresh.onRefresh} refreshing={refresh.refreshing} tintColor={theme.color.muted} />}
      initialNumToRender={2}
      keyExtractor={(trip) => trip.tripId}
      renderItem={({ item }) => <TripUpdates now={now} trip={item} />}
      style={{ backgroundColor: theme.color.ground }}
    />
  );
}
