import { space, Text, useAppTheme } from '@citius/ui';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementSkeleton } from '@/components/skeletons';
import { AnnouncementItem } from '@/components/trip-sections';
import { useTrip } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import { useNow } from '@/lib/use-now';

/** Every message the tour managers sent to this traveller (or their children), newest first. */
export default function TripUpdates() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const now = useNow();
  const items = trip.data?.announcements ?? [];
  const card = {
    backgroundColor: theme.color.card,
    borderColor: theme.color.border,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
  };
  return (
    <FlatList
      ListEmptyComponent={
        trip.loading ? (
          <View style={[card, { borderRadius: theme.radius.surface, borderWidth: StyleSheet.hairlineWidth }]}>
            <AnnouncementSkeleton />
            <AnnouncementSkeleton />
            <AnnouncementSkeleton last />
          </View>
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
