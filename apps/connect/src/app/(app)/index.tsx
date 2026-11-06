import { Banner, Button, StatusPill, space, Surface, Text } from '@citius/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { FreshnessStamp } from '@/components/freshness';
import { CallButton, formatDateRange, Placeholder, Row, Screen, SectionTitle } from '@/components/kit';
import { headcountAnswer, PARTIAL_ROSTER_NOTICE, summarize } from '@/features/headcount/headcount';
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
  const answer = headcountAnswer(summary, pack);
  const missingShown = summary.missing.slice(0, MISSING_SHOWN);
  return (
    <Surface style={{ gap: space.md }}>
      <View accessible accessibilityLabel={`${answer} at ${summary.stopLabel}`}>
        <Text variant="answer" tabular>
          {answer}
        </Text>
        <Text variant="secondary" tone="muted">
          {summary.stopLabel}
        </Text>
      </View>
      {pack.complete ? null : (
        <Text tone="warning" variant="secondary">
          {PARTIAL_ROSTER_NOTICE}
        </Text>
      )}
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

/** "Is everyone here?" for the trip on tour, and the tour manager's trips. */
export default function Today() {
  const {
    packProblem,
    pack,
    refreshPack,
    refreshTrips,
    refreshing,
    selectTrip,
    selected,
    trips,
    tripsComplete,
    tripsLoaded,
    tripsProblem,
    tripsSavedAt,
  } = useTrips();
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
      {tripsLoaded && tripsComplete && trips.length === 0 ? (
        <Text tone="muted">No trips are assigned to you. Operations assigns tour managers on the Job Card.</Text>
      ) : null}
      {tripsLoaded && !tripsComplete ? (
        <Text tone="warning" variant="secondary">
          Not every trip could be loaded, so some of yours may be missing here. Pull down to try again.
        </Text>
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
