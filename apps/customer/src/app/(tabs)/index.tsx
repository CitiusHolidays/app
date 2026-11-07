import { Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { Icon, PageTitle, Placeholder, Screen, SectionTitle } from '@/components/kit';
import { prefetchCover, ScrollWindowContext } from '@/components/destination-cover';
import { Freshness, TripCard } from '@/components/trip-cards';
import { useCustomerSession } from '@/features/session/session';
import { featuredTrip, splitTrips } from '@/features/trips/model';
import { useTrips } from '@/features/trips/use-trips';
import { useI18n } from '@/i18n/i18n';
import { useNow } from '@/lib/use-now';

function openTrip(tripId: string) {
  router.push({ params: { id: tripId }, pathname: '/trip/[id]' });
}

function NoTrips() {
  const theme = useAppTheme();
  const { t } = useI18n();
  return (
    <Surface variant="hero" style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
      <View style={{ alignItems: 'center', backgroundColor: theme.color.inset, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 }}>
        <Icon color={theme.color.primary} ios="airplane.departure" md="flight_takeoff" size={28} />
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

/** Journeys: the trip happening now or next, then upcoming and past trips (past trips stay). */
export default function Journeys() {
  const i18n = useI18n();
  const { gate } = useCustomerSession();
  const trips = useTrips();
  const now = useNow();
  const list = trips.data ?? [];
  const lead = featuredTrip(list);
  const { active, past } = splitTrips(list);
  const upcoming = active.filter((trip) => trip.tripId !== lead?.tripId);
  const offline = gate.kind === 'signedIn' && gate.offline;
  const { height, width } = useWindowDimensions();
  const [scrollY, setScrollY] = useState(0);
  const scrollWindow = useMemo(() => ({ scrollY, viewport: height }), [height, scrollY]);
  // The trip most likely to be opened next: start its header photo now.
  const leadCover = lead?.cover ?? null;
  useEffect(() => {
    prefetchCover(leadCover, width);
  }, [leadCover, width]);
  const kicker = new Intl.DateTimeFormat(i18n.language.intl, { day: 'numeric', month: 'long', weekday: 'long' }).format(new Date(now));
  return (
    <ScrollWindowContext.Provider value={scrollWindow}>
    <Screen
      header={<PageTitle kicker={kicker} title={i18n.t('journeys.title')} />}
      onScroll={(event) => setScrollY(Math.max(0, event.nativeEvent.contentOffset.y))}
      scrollEventThrottle={200}
    >
      <Freshness offline={offline} savedAt={trips.live ? null : trips.savedAt} />
      {trips.loading ? (
        <Surface variant="hero" style={{ height: 460, justifyContent: 'flex-end' }}>
          <Placeholder label={i18n.t('common.loading')} lines={3} />
        </Surface>
      ) : list.length === 0 ? (
        <NoTrips />
      ) : null}
      {lead ? <TripCard lead now={now} onPress={() => openTrip(lead.tripId)} trip={lead} /> : null}
      {upcoming.length ? (
        <View style={{ gap: space.md }}>
          <SectionTitle>{i18n.t('journeys.upcoming')}</SectionTitle>
          {upcoming.map((trip) => (
            <TripCard key={trip.tripId} now={now} onPress={() => openTrip(trip.tripId)} trip={trip} />
          ))}
        </View>
      ) : null}
      {past.length ? (
        <View style={{ gap: space.md }}>
          <SectionTitle>{i18n.t('journeys.past')}</SectionTitle>
          {past.map((trip) => (
            <TripCard key={trip.tripId} now={now} onPress={() => openTrip(trip.tripId)} trip={trip} />
          ))}
        </View>
      ) : null}
      {list.length > 0 ? (
        <Button label={i18n.t('journeys.haveLink')} onPress={() => router.push('/invite-entry')} variant="secondary" />
      ) : null}
    </Screen>
    </ScrollWindowContext.Provider>
  );
}
