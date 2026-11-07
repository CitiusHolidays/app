import { Banner, Button, face, space, StatusPill, Surface, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { FreshnessStamp } from '@/components/freshness';
import {
  ActionTray,
  Avatar,
  Icon,
  ListCard,
  Placeholder,
  QuietState,
  Row,
  Screen,
  SectionTitle,
  Tag,
  TickStrip,
} from '@/components/kit';
import { headcountAnswer, PARTIAL_ROSTER_NOTICE, summarize } from '@/features/headcount/headcount';
import { useHeadcount } from '@/features/headcount/use-headcount';
import { useInbox } from '@/features/inbox/use-inbox';
import { dayOfTrip, tripPhase } from '@/features/trips/trips';
import { type TripSummary, useTrips } from '@/features/trips/trips-context';
import { useNow } from '@/lib/use-now';
import { dateKicker, formatDateRange } from '@/lib/dates';

const MISSING_SHOWN = 5;
const INBOX_SHOWN = 2;

function phaseLabel(trip: TripSummary, now: number) {
  const phase = tripPhase(trip, now);
  if (phase === 'today') return dayOfTrip(trip, now) ?? 'On tour';
  if (phase === 'upcoming') return 'Upcoming';
  if (phase === 'past') return 'Finished';
  return 'Dates not set';
}

/** The screen's answer: "Is everyone here, and who isn't?" One tick per traveller. */
function HeadcountCard() {
  const theme = useAppTheme();
  const { pack, packLoading, packProblem, selected } = useTrips();
  const { state } = useHeadcount(selected?.id ?? null);
  if (!selected) return null;
  if (packLoading && !pack) {
    return (
      <Surface variant="hero">
        <Placeholder lines={4} />
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
  const everyone = answer.startsWith('All');
  const missingShown = summary.missing.slice(0, MISSING_SHOWN);
  const more = summary.missing.length - missingShown.length;
  return (
    <Surface style={{ gap: space.lg }} variant="hero">
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">Headcount · {summary.stopLabel}</Text>
        <Icon color={theme.color.muted} ios="person.3" md="groups" size={18} />
      </View>
      <View accessible accessibilityLabel={`${answer} at ${summary.stopLabel}`} style={{ gap: space.md }}>
        <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 6 }}>
          <Text tabular variant="answer">
            {everyone ? 'All' : summary.present}
          </Text>
          <Text tabular tone="muted" variant="section" style={face(theme, 'medium')}>
            {everyone ? `${summary.expected} here` : `/ ${summary.expected} here`}
          </Text>
        </View>
        <TickStrip marked={summary.present} total={summary.expected} />
      </View>
      {pack.complete ? null : (
        <Text tone="warning" variant="secondary">
          {PARTIAL_ROSTER_NOTICE}
        </Text>
      )}
      {summary.missing.length > 0 ? (
        <Surface style={{ gap: space.md }} variant="inset">
          <Text tone="muted" variant="label">
            Still to mark · {summary.missing.length}
          </Text>
          <View accessibilityLabel={`Not marked yet: ${summary.missing.map((entry) => entry.name).join(', ')}`} accessible style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {missingShown.map((entry) => (
              <View key={entry.id} style={{ alignItems: 'center', gap: 6, width: 46 }}>
                <Avatar name={entry.name} size={40} />
                <Text numberOfLines={1} tone="muted" variant="label" style={{ fontSize: 12 }}>
                  {entry.name.split(' ')[0]}
                </Text>
              </View>
            ))}
            {more > 0 ? (
              <View style={{ alignItems: 'center', gap: 6, width: 46 }}>
                <View
                  style={{
                    alignItems: 'center',
                    borderColor: theme.color.border,
                    borderRadius: 20,
                    borderWidth: 1,
                    height: 40,
                    justifyContent: 'center',
                    width: 40,
                  }}
                >
                  <Text tabular variant="label">
                    +{more}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </Surface>
      ) : (
        <QuietState good text={`Everyone is marked here at ${summary.stopLabel}.`} />
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1.3 }}>
          <Button label="Take headcount" onPress={() => router.push('/headcount')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Announce" onPress={() => router.push('/announce')} variant="secondary" />
        </View>
      </View>
    </Surface>
  );
}

/** The programme for the trip, until the app has a day-by-day schedule. */
function ProgrammeCard({ text, onOpen }: { onOpen: () => void; text: string }) {
  const theme = useAppTheme();
  return (
    <Surface style={{ gap: space.md }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">Programme</Text>
        <Icon color={theme.color.muted} ios="calendar" md="calendar_today" size={17} />
      </View>
      <Text numberOfLines={3} variant="section">
        {text}
      </Text>
      <Button
        icon={<Icon ios="list.bullet" md="list" size={15} />}
        label="Open schedule"
        onPress={onOpen}
        variant="secondary"
      />
    </Surface>
  );
}

function InboxPreview() {
  const { rows } = useInbox();
  const unread = rows.filter((row) => !row.readAt);
  const shown = (unread.length > 0 ? unread : rows).slice(0, INBOX_SHOWN);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle action={{ label: 'See all', onPress: () => router.push('/inbox') }}>
        {unread.length > 0 ? `Inbox · ${unread.length} new` : 'Inbox'}
      </SectionTitle>
      <ListCard>
        {shown.map((row, index) => (
          <Row
            chevron
            key={row.id}
            last={index === shown.length - 1}
            onPress={() => router.push({ params: { id: row.id }, pathname: '/notification/[id]' })}
            subtitle={row.body}
            title={row.title}
          />
        ))}
      </ListCard>
    </View>
  );
}

/** The opening: date and trip day over the trip's name, its code, batches and how fresh it is. */
function TodayHeader({ now }: { now: number }) {
  const theme = useAppTheme();
  const { pack, packProblem, selected, tripsProblem, tripsSavedAt } = useTrips();
  const phase = selected ? phaseLabel(selected, now) : null;
  const problem = packProblem ?? tripsProblem;
  const savedAt = pack?.savedAt ?? tripsSavedAt;
  return (
    <View style={{ gap: space.md }}>
      <View accessible accessibilityRole="header" style={{ gap: space.xs + 2 }}>
        <Text tone="muted" variant="mono">
          {[dateKicker(now), phase].filter(Boolean).join(' · ')}
        </Text>
        <Text variant="display">{selected ? selected.clientName || selected.jobCode : 'Today'}</Text>
        {selected ? (
          <Text tone="muted" variant="secondary">
            {selected.destination || 'Destination not set'} · {formatDateRange(selected.travelStartDate, selected.travelEndDate)}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Tag label={selected.jobCode} />
          {pack && pack.batches.length > 0 ? (
            <Tag
              icon={<Icon color={theme.color.muted} ios="bus" md="directions_bus" size={13} />}
              label={`${pack.batches.length} ${pack.batches.length === 1 ? 'batch' : 'batches'}`}
            />
          ) : null}
          <FreshnessStamp part="pill" problem={problem} savedAt={savedAt} />
        </View>
      ) : null}
      <FreshnessStamp part={selected ? 'notice' : undefined} problem={problem} savedAt={savedAt} />
    </View>
  );
}

const TODAY_ACTIONS = [
  { icon: { ios: 'person.text.rectangle', md: 'badge' }, label: 'Roster', onPress: () => router.push({ params: { view: 'roster' }, pathname: '/trip' }) },
  { icon: { ios: 'phone', md: 'call' }, label: 'Contacts', onPress: () => router.push({ params: { view: 'contacts' }, pathname: '/trip' }) },
  { icon: { ios: 'creditcard', md: 'receipt_long' }, label: 'Expense', onPress: () => router.push('/expense-new') },
  { icon: { ios: 'megaphone', md: 'campaign' }, label: 'Announce', onPress: () => router.push('/announce') },
];

/** Whether the trip list could be loaded: still loading, empty, or only partly loaded. */
function TripsStatus() {
  const { trips, tripsComplete, tripsLoaded } = useTrips();
  if (!tripsLoaded) {
    return (
      <Surface>
        <Placeholder lines={3} />
      </Surface>
    );
  }
  if (!tripsComplete) {
    return (
      <Banner tone="attention">
        <Text variant="secondary">Not every trip could be loaded, so some of yours may be missing here. Pull down to try again.</Text>
      </Banner>
    );
  }
  return trips.length === 0 ? (
    <Surface>
      <QuietState text="No trips yet. A trip shows here once Operations assigns you to it and starts the app for that trip." />
    </Surface>
  ) : null;
}

/** The tour manager's trips, to switch between when there is more than one. */
function YourTrips({ now }: { now: number }) {
  const { selectTrip, selected, trips } = useTrips();
  if (trips.length <= 1) return null;
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>Your trips</SectionTitle>
      <ListCard>
        {trips.map((trip, index) => {
          const isSelected = trip.id === selected?.id;
          return (
            <Row
              accessibilityLabel={`${trip.clientName || trip.jobCode}, ${formatDateRange(trip.travelStartDate, trip.travelEndDate)}, ${trip.status}${isSelected ? ', selected' : ''}`}
              key={trip.id}
              last={index === trips.length - 1}
              onPress={() => selectTrip(trip.id)}
              subtitle={`${trip.jobCode} · ${formatDateRange(trip.travelStartDate, trip.travelEndDate)} · ${phaseLabel(trip, now)}`}
              title={trip.clientName || trip.jobCode}
              trailing={<StatusPill kind={isSelected ? 'good' : 'neutral'} label={isSelected ? 'Selected' : trip.status} />}
            />
          );
        })}
      </ListCard>
    </View>
  );
}

/** "Is everyone here, and what's next?" for the trip on tour, then the tour manager's trips. */
export default function Today() {
  const { pack, refreshPack, refreshTrips, refreshing, selected } = useTrips();
  const now = useNow();
  return (
    <Screen
      header={<TodayHeader now={now} />}
      onRefresh={() => {
        void refreshTrips();
        void refreshPack();
      }}
      refreshing={refreshing}
    >
      <HeadcountCard />
      {selected ? <ActionTray actions={TODAY_ACTIONS} /> : null}
      {pack?.schedule.itineraryText ? (
        <ProgrammeCard onOpen={() => router.push({ params: { view: 'schedule' }, pathname: '/trip' })} text={pack.schedule.itineraryText} />
      ) : null}
      <InboxPreview />
      <TripsStatus />
      <YourTrips now={now} />
    </Screen>
  );
}
