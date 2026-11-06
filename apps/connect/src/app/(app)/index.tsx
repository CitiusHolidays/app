import { staffApi } from '@citius/backend';
import { Banner, Button, StatusPill, space, Surface, Text } from '@citius/ui';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { FreshnessStamp } from '@/components/freshness';
import { CallButton, formatDateRange, Placeholder, Row, Screen, SectionTitle } from '@/components/kit';
import { useStaff, useStaffSession } from '@/features/gate/session';
import { headcountAnswer, summarize } from '@/features/headcount/headcount';
import { useHeadcount } from '@/features/headcount/use-headcount';
import { dayOfTrip, tripPhase } from '@/features/trips/trips';
import { type TripSummary, useTrips } from '@/features/trips/trips-context';
import { useNow } from '@/lib/use-now';

const MISSING_SHOWN = 5;

function phaseLabel(trip: TripSummary, now: number) {
  const phase = tripPhase(trip, now);
  if (phase === 'today') return dayOfTrip(trip, now) ?? 'On tour';
  if (phase === 'upcoming') return 'Upcoming';
  if (phase === 'past') return 'Finished';
  return 'Dates not set';
}

/** "Is everyone here, and who isn't?" for the selected trip. */
function HeadcountAnswer() {
  const { pack, packLoading, packProblem, selected } = useTrips();
  const { state } = useHeadcount(selected?.id ?? null);
  if (!selected) return null;
  if (packLoading && !pack) {
    return (
      <Surface>
        <Placeholder lines={3} />
      </Surface>
    );
  }
  if (!pack || !state) {
    return (
      <Banner tone="attention">
        <Text variant="bodyStrong">No trip pack on this phone yet</Text>
        <Text variant="secondary">{packProblem ?? 'Connect to the internet once to save the roster for offline use.'}</Text>
      </Banner>
    );
  }
  const summary = summarize(state, pack.roster);
  const missingShown = summary.missing.slice(0, MISSING_SHOWN);
  return (
    <Surface style={{ gap: space.md }}>
      <View accessible accessibilityLabel={`${headcountAnswer(summary)} at ${summary.stopLabel}`}>
        <Text variant="answer" tabular>
          {headcountAnswer(summary)}
        </Text>
        <Text variant="secondary" tone="muted">
          {summary.stopLabel}
        </Text>
      </View>
      {summary.missing.length > 0 ? (
        <View>
          <Text variant="bodyStrong" tone="warning">
            Not marked yet
          </Text>
          {missingShown.map((entry) => (
            <Row
              key={entry.id}
              subtitle={entry.batchLabel || undefined}
              title={entry.name}
              trailing={entry.phone ? <CallButton name={entry.name} phone={entry.phone} /> : undefined}
            />
          ))}
          {summary.missing.length > MISSING_SHOWN ? (
            <Text variant="secondary" tone="muted">
              and {summary.missing.length - MISSING_SHOWN} more
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <View style={{ flexGrow: 1 }}>
          <Button label="Take headcount" onPress={() => router.push('/headcount')} />
        </View>
        <View style={{ flexGrow: 1 }}>
          <Button label="Announce" onPress={() => router.push('/announce')} variant="secondary" />
        </View>
        <View style={{ flexGrow: 1 }}>
          <Button label="Add expense" onPress={() => router.push('/expense-new')} variant="secondary" />
        </View>
      </View>
    </Surface>
  );
}

function TourManagerToday() {
  const { packProblem, pack, refreshPack, refreshTrips, refreshing, selectTrip, selected, trips, tripsLoaded, tripsProblem, tripsSavedAt } =
    useTrips();
  const now = useNow();
  return (
    <Screen
      onRefresh={() => {
        void refreshTrips();
        void refreshPack();
      }}
      refreshing={refreshing}
      title="Today"
    >
      {selected ? (
        <View accessible accessibilityRole="header">
          <Text variant="section">{selected.clientName || selected.jobCode}</Text>
          <Text variant="secondary" tabular tone="muted">
            {selected.jobCode} · {selected.destination || 'Destination not set'} · {phaseLabel(selected, now)}
          </Text>
        </View>
      ) : null}
      <FreshnessStamp problem={packProblem ?? tripsProblem} savedAt={pack?.savedAt ?? tripsSavedAt} />
      <HeadcountAnswer />
      <SectionTitle>Your trips</SectionTitle>
      {!tripsLoaded ? <Placeholder lines={4} /> : null}
      {tripsLoaded && trips.length === 0 ? (
        <Text tone="muted">No trips are assigned to you. Operations assigns tour managers on the Job Card.</Text>
      ) : null}
      <View>
        {trips.map((trip) => {
          const isSelected = trip.id === selected?.id;
          return (
            <Row
              accessibilityLabel={`${trip.clientName || trip.jobCode}, ${formatDateRange(trip.travelStartDate, trip.travelEndDate)}, ${trip.status}${isSelected ? ', selected' : ''}`}
              key={trip.id}
              onPress={() => selectTrip(trip.id)}
              subtitle={`${trip.jobCode} · ${formatDateRange(trip.travelStartDate, trip.travelEndDate)} · ${phaseLabel(trip, now)}`}
              title={trip.clientName || trip.jobCode}
              trailing={<StatusPill kind={isSelected ? 'good' : 'neutral'} label={isSelected ? 'Selected' : trip.status} />}
            />
          );
        })}
      </View>
    </Screen>
  );
}

/** Office staff: "What needs my decision today?" as a short dated digest. */
function OfficeToday() {
  const staff = useStaff();
  const notifications = useQuery(staffApi.listNotifications.ref, { limit: 20 });
  const unread = (notifications ?? []).filter((item) => !item.readAt).slice(0, 5);
  return (
    <Screen title="My work today">
      <Text variant="secondary" tone="muted">
        Signed in as {staff.name} · {staff.roles.join(', ') || 'No role yet'}
      </Text>
      {notifications === undefined ? <Placeholder lines={3} /> : null}
      {notifications && unread.length === 0 ? <Text>Nothing new needs you. Your inbox is up to date.</Text> : null}
      {unread.map((item) => (
        <Row
          key={item.id}
          onPress={() => router.push({ params: { id: item.id }, pathname: '/notification/[id]' })}
          subtitle={item.body}
          title={item.title}
        />
      ))}
      <Text variant="secondary" tone="muted">
        Trip-day tools (trip pack, headcount, announcements) appear for tour managers.
      </Text>
    </Screen>
  );
}

export default function Today() {
  const { isTourManager } = useStaffSession();
  return isTourManager ? <TourManagerToday /> : <OfficeToday />;
}
