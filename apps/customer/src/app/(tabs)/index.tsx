import { Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, PageTitle, SectionTitle, TAB_BAR_CLEARANCE } from '@/components/kit';
import { Pop } from '@/components/motion-views';
import { JourneysSkeleton } from '@/components/skeletons';
import { Freshness, TripCard } from '@/components/trip-cards';
import { NotSaved } from '@/components/trip-states';
import { useCustomerSession } from '@/features/session/session';
import { featuredTrip, type JourneyRow, journeyRows, type JourneySection } from '@/features/trips/model';
import { prefetchCover } from '@/features/trips/prefetch-cover';
import { useTrips } from '@/features/trips/use-trips';
import { formatLongDate } from '@/i18n/format';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { useNow } from '@/lib/use-now';
import { usePullRefresh } from '@/lib/use-pull-refresh';

const SECTION_TITLE: Record<JourneySection, MessageKey> = {
  next: 'journeys.nextTrip',
  now: 'journeys.happeningNow',
  past: 'journeys.past',
  upcoming: 'journeys.upcoming',
};

function openTrip(tripId: string) {
  router.push({ params: { id: tripId }, pathname: '/trip/[id]' });
}

function NoTrips() {
  const theme = useAppTheme();
  const { t } = useI18n();
  return (
    <Surface variant="hero" style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
      {/* First run: the mark settles inside two soft rings, once (the owner's empty-state reference). */}
      <View style={{ alignItems: 'center', height: 136, justifyContent: 'center', width: 136 }}>
        <Pop delay={160} style={[StyleSheet.absoluteFill, { borderColor: theme.color.border, borderRadius: 68, borderWidth: 1 }]}>
          <View />
        </Pop>
        <Pop delay={80} style={{ borderColor: theme.color.border, borderRadius: 50, borderWidth: 1, height: 100, position: 'absolute', width: 100 }}>
          <View />
        </Pop>
        <Pop style={{ alignItems: 'center', backgroundColor: theme.color.inset, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 }}>
          <Icon color={theme.color.primary} ios="airplane.departure" md="flight_takeoff" size={28} />
        </Pop>
      </View>
      <Text accessibilityRole="header" variant="section">
        {t('journeys.emptyTitle')}
      </Text>
      <Text style={{ maxWidth: 320, textAlign: 'center' }} tone="muted">
        {t('journeys.emptyBody')}
      </Text>
      <Button label={t('journeys.haveLink')} onPress={() => router.push('/invite-entry')} variant="secondary" />
    </Surface>
  );
}

/**
 * Journeys: the trip happening now or next, then upcoming and past trips (past trips stay). The
 * list is virtualised, so only the cards on or near the screen are mounted and load their photos.
 */
export default function Journeys() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const i18n = useI18n();
  const { offline } = useCustomerSession();
  const trips = useTrips();
  const now = useNow();
  const { width } = useWindowDimensions();
  const list = useMemo(() => trips.data ?? [], [trips.data]);
  const rows = useMemo(() => journeyRows(list, now), [list, now]);
  const refresh = usePullRefresh(trips.status === 'live');

  // The trip most likely to be opened next: start its header photo now.
  const leadCover = featuredTrip(list, now)?.cover ?? null;
  useEffect(() => {
    prefetchCover(leadCover, width);
  }, [leadCover, width]);

  const kicker = formatLongDate(i18n.language.intl, now);
  const header = (
    <View style={{ gap: space.lg + 4, paddingBottom: space.lg + 4 }}>
      <PageTitle kicker={kicker} title={i18n.t('journeys.title')} />
      {trips.status === 'unavailable' ? <NotSaved /> : <Freshness offline={offline} savedAt={trips.status === 'live' ? null : trips.savedAt} />}
      {trips.status === 'loading' ? <JourneysSkeleton label={i18n.t('common.loading')} /> : null}
      {(trips.status === 'live' || trips.status === 'saved') && list.length === 0 ? <NoTrips /> : null}
    </View>
  );

  const renderItem = ({ item }: { item: JourneyRow }) => {
    if (item.kind === 'section') {
      return (
        <View style={{ paddingBottom: space.md, paddingTop: space.lg }}>
          <SectionTitle>{i18n.t(SECTION_TITLE[item.section])}</SectionTitle>
        </View>
      );
    }
    return (
      <View style={{ paddingBottom: space.md }}>
        <TripCard lead={item.kind === 'lead'} now={now} onPress={() => openTrip(item.trip.tripId)} trip={item.trip} />
      </View>
    );
  };

  return (
    <FlatList
      ListFooterComponent={
        list.length > 0 ? (
          <View style={{ paddingTop: space.lg }}>
            <Button label={i18n.t('journeys.haveLink')} onPress={() => router.push('/invite-entry')} variant="secondary" />
          </View>
        ) : undefined
      }
      ListHeaderComponent={header}
      refreshControl={<RefreshControl onRefresh={refresh.onRefresh} refreshing={refresh.refreshing} tintColor={theme.color.muted} />}
      contentContainerStyle={{
        paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        paddingHorizontal: theme.frame,
        paddingTop: Platform.OS === 'ios' ? space.sm : insets.top + space.md,
      }}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      initialNumToRender={3}
      keyExtractor={(row) => row.key}
      maxToRenderPerBatch={2}
      removeClippedSubviews={Platform.OS === 'android'}
      renderItem={renderItem}
      style={{ backgroundColor: theme.color.ground }}
      windowSize={5}
    />
  );
}
