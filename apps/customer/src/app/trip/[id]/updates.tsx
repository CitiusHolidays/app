import { space, Text, useAppTheme } from '@citius/ui';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementRows } from '@/components/skeletons';
import { AnnouncementItem } from '@/components/trip-sections';
import { NotSaved, TripUnavailable } from '@/components/trip-states';
import { Freshness } from '@/components/trip-cards';
import { useCustomerSession } from '@/features/session/session';
import { useTrip } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import { useNow } from '@/lib/use-now';

export { ScreenError as ErrorBoundary } from '@/components/error-boundary';

/** Every message the tour managers sent to this traveller (or their children), newest first. */
export default function TripUpdates() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const { offline } = useCustomerSession();
  const now = useNow();
  const items = trip.data?.announcements ?? [];
  if (trip.data === null) return <TripUnavailable />;
  const card = {
    backgroundColor: theme.color.card,
    borderColor: theme.color.border,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
  };
  return (
    <FlatList
      ListHeaderComponent={
        <View style={{ paddingBottom: space.md }}>
          {/* Opened from the Updates tab, which lists several trips: the title says which one. */}
          <Stack.Screen options={trip.data ? { title: trip.data.trip.destination } : {}} />
          {trip.status === 'unavailable' ? null : <Freshness offline={offline} savedAt={trip.status === 'live' ? null : trip.savedAt} />}
        </View>
      }
      ListEmptyComponent={
        trip.status === 'loading' ? (
          <View style={[card, { borderRadius: theme.radius.surface, borderWidth: StyleSheet.hairlineWidth }]}>
            <AnnouncementRows count={3} label={t('common.loading')} />
          </View>
        ) : trip.status === 'unavailable' ? (
          <NotSaved />
        ) : (
          <Text tone="muted">{t('trip.noUpdates')}</Text>
        )
      }
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl, paddingHorizontal: theme.frame, paddingTop: space.lg }}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      initialNumToRender={8}
      keyExtractor={(item) => item.id}
      renderItem={({ index, item }) => {
        const first = index === 0;
        const last = index === items.length - 1;
        // One card drawn across the rows: rounded top on the first, rounded foot on the last.
        return (
          <View
            style={[
              card,
              first ? { borderTopLeftRadius: theme.radius.surface, borderTopRightRadius: theme.radius.surface, borderTopWidth: StyleSheet.hairlineWidth } : null,
              last ? { borderBottomLeftRadius: theme.radius.surface, borderBottomRightRadius: theme.radius.surface, borderBottomWidth: StyleSheet.hairlineWidth } : null,
            ]}
          >
            <AnnouncementItem announcement={item} last={last} now={now} />
          </View>
        );
      }}
      style={{ backgroundColor: theme.color.ground }}
    />
  );
}
