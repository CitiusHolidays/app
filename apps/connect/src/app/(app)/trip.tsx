import { Banner, Button, StatusPill, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FreshnessStamp } from '@/components/freshness';
import {
  Avatar,
  CallButton,
  formatDateRange,
  Icon,
  ListCard,
  PageTitle,
  Placeholder,
  QuietState,
  Row,
  Screen,
  Segmented,
} from '@/components/kit';
import { callingPill, groupRoster, rosterMeta } from '@/features/trip-pack/roster';
import { type ScheduleStep, tripSchedule } from '@/features/trip-pack/schedule';
import type { TripPack } from '@/features/trip-pack/trip-pack';
import { resolveTripView, type TripView } from '@/features/trips/trip-view';
import { useStaff } from '@/features/gate/session';
import { useTrips } from '@/features/trips/trips-context';
import { useNow } from '@/lib/use-now';

const VIEWS: { label: string; value: TripView }[] = [
  { label: 'Roster', value: 'roster' },
  { label: 'Schedule', value: 'schedule' },
  { label: 'Contacts', value: 'contacts' },
];

function Roster({ pack }: { pack: TripPack }) {
  const groups = groupRoster(pack);
  const travelling = pack.roster.filter((entry) => entry.travelling).length;
  return (
    <View style={{ gap: space.lg }}>
      <Text tabular tone="muted" variant="secondary">
        {travelling} travelling · {pack.batches.length} {pack.batches.length === 1 ? 'travel batch' : 'travel batches'}
      </Text>
      {pack.complete ? null : (
        <Banner tone="attention">
          <Text variant="secondary">Not every traveller or contact could be loaded. Pull down to refresh the trip pack.</Text>
        </Banner>
      )}
      {groups.length === 0 ? (
        <Surface>
          <QuietState text="No travellers are on this trip's roster yet." />
        </Surface>
      ) : null}
      {groups.map((group) => (
        <View key={group.id} style={{ gap: space.sm }}>
          <View
            accessible
            accessibilityLabel={`${group.label}, ${group.travelling} travelling`}
            accessibilityRole="header"
            style={{ alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs }}
          >
            <Text style={{ flexShrink: 1 }} numberOfLines={1} variant="bodyStrong">
              {group.label}
            </Text>
            <Text tabular tone="muted" variant="label">
              {group.travelling} travelling
            </Text>
          </View>
          <ListCard>
            {group.entries.map((entry, index) => {
              const pill = callingPill(entry.callingStatus);
              const meta = rosterMeta(entry);
              return (
                <Row
                  accessibilityLabel={[entry.name, meta, `calling: ${pill.label}`].filter(Boolean).join(', ')}
                  detail={entry.phone ? <StatusPill kind={pill.kind} label={pill.label} /> : undefined}
                  key={entry.id}
                  last={index === group.entries.length - 1}
                  leading={<Avatar name={entry.name} />}
                  subtitle={meta || undefined}
                  title={entry.name}
                  trailing={
                    entry.phone ? (
                      <CallButton name={entry.name} phone={entry.phone} />
                    ) : (
                      <StatusPill kind={pill.kind} label={pill.label} />
                    )
                  }
                />
              );
            })}
          </ListCard>
        </View>
      ))}
    </View>
  );
}

const STATE_WORDS = { current: 'today', done: 'done', undated: '', upcoming: 'coming up' } as const;

/** One stop on the timeline: a node joined to the next by a rule. */
function Step({ last, step }: { last: boolean; step: ScheduleStep }) {
  const theme = useAppTheme();
  const date = step.date
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', weekday: 'short' }).format(step.date)
    : null;
  const heading = [step.dayLabel, date].filter(Boolean).join(' · ');
  const node =
    step.state === 'done' ? (
      <View style={{ alignItems: 'center', backgroundColor: theme.color.successSoft, borderRadius: 11, height: 22, justifyContent: 'center', width: 22 }}>
        <Icon color={theme.color.success} ios="checkmark" md="check" size={11} />
      </View>
    ) : step.state === 'current' ? (
      <View style={{ alignItems: 'center', borderColor: theme.color.accent, borderRadius: 11, borderWidth: 2, height: 22, justifyContent: 'center', width: 22 }}>
        <View style={{ backgroundColor: theme.color.accent, borderRadius: 4, height: 8, width: 8 }} />
      </View>
    ) : step.state === 'upcoming' ? (
      <View style={{ backgroundColor: theme.color.card, borderColor: theme.color.pending, borderRadius: 11, borderStyle: 'dashed', borderWidth: 1.2, height: 22, width: 22 }} />
    ) : (
      <View style={{ alignItems: 'center', height: 22, justifyContent: 'center', width: 22 }}>
        <View style={{ backgroundColor: theme.color.controlBorder, borderRadius: 4, height: 8, width: 8 }} />
      </View>
    );
  return (
    <View
      accessible
      accessibilityLabel={[heading, STATE_WORDS[step.state], step.text].filter(Boolean).join(', ')}
      style={{ flexDirection: 'row', gap: space.md }}
    >
      <View style={{ alignItems: 'center', width: 22 }}>
        {node}
        {last ? null : <View style={{ backgroundColor: theme.color.rule, flex: 1, marginVertical: 4, minHeight: 12, width: 2 }} />}
      </View>
      <View style={{ flex: 1, gap: 2, paddingBottom: last ? 0 : space.lg, paddingTop: 2 }}>
        {heading ? (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}>
            <Text tabular tone="muted" variant="label">
              {heading}
            </Text>
            {step.state === 'current' ? (
              <Text tone="accent" variant="label">
                Today
              </Text>
            ) : null}
          </View>
        ) : null}
        {step.text ? (
          <Text selectable tone={step.state === 'done' ? 'muted' : 'ink'}>
            {step.text}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Schedule({ now, pack }: { now: number; pack: TripPack }) {
  const { steps, summary } = tripSchedule(pack.schedule.itineraryText, pack.travelStartDate, pack.travelEndDate, now);
  return (
    <Surface style={{ gap: space.lg }}>
      {summary ? (
        <View style={{ gap: 2 }}>
          <Text variant="section">{summary}</Text>
          <Text tone="muted" variant="secondary">
            The day-by-day plan is on the proposal. These are the days of the trip.
          </Text>
        </View>
      ) : null}
      {steps.length === 0 ? (
        <QuietState text="No itinerary text is on the Job Card's proposal yet." />
      ) : (
        <View>
          {steps.map((step, index) => (
            <Step key={step.key} last={index === steps.length - 1} step={step} />
          ))}
        </View>
      )}
      {pack.schedule.proposalCode ? (
        <Surface style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }} variant="inset">
          <Text tone="muted" variant="label">
            From proposal
          </Text>
          <Text variant="mono">{pack.schedule.proposalCode}</Text>
        </Surface>
      ) : null}
    </Surface>
  );
}

function Contacts({ pack }: { pack: TripPack }) {
  const me = useStaff().name.trim().toLowerCase();
  if (pack.contacts.length === 0) {
    return (
      <Surface>
        <QuietState text="No contacts are recorded for this trip." />
      </Surface>
    );
  }
  return (
    <ListCard>
      {pack.contacts.map((contact, index) => (
        <Row
          key={`${contact.role}-${index}`}
          last={index === pack.contacts.length - 1}
          leading={<Avatar name={contact.name} />}
          subtitle={[contact.role, contact.note].filter(Boolean).join(' · ')}
          title={contact.name}
          trailing={
            contact.name.trim().toLowerCase() === me ? (
              <StatusPill kind="live" label="You" />
            ) : contact.phone ? (
              <CallButton name={contact.name} phone={contact.phone} />
            ) : undefined
          }
        />
      ))}
    </ListCard>
  );
}

/** "Who is on this trip and how do I reach them?" The offline trip pack, read-only. */
export default function TripPackScreen() {
  const { pack, packLoading, packProblem, refreshPack, selected } = useTrips();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [section, setSection] = useState<TripView>(() => resolveTripView(view));
  // Today opens this tab on a view ("Contacts"); follow the param when it changes.
  const [seenView, setSeenView] = useState(view);
  if (view !== seenView) {
    setSeenView(view);
    if (view) setSection(resolveTripView(view));
  }
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow();

  const refresh = () => {
    setRefreshing(true);
    void refreshPack().finally(() => setRefreshing(false));
  };
  const choose = (next: TripView) => {
    setSection(next);
    // Keeps the param in step, so a later link to the same view still switches to it.
    router.setParams({ view: next });
  };

  if (!selected) {
    return (
      <Screen title="Trip">
        <Surface>
          <QuietState text="Choose a trip on Today first." />
        </Surface>
      </Screen>
    );
  }

  const destination = [selected.destination || 'Destination not set', formatDateRange(selected.travelStartDate, selected.travelEndDate)].join(' · ');
  return (
    <Screen
      header={<PageTitle kicker={selected.jobCode} meta={destination} title={selected.clientName || selected.jobCode} />}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      <FreshnessStamp problem={packProblem} savedAt={pack?.savedAt ?? null} />
      <Segmented label="Trip pack section" onChange={choose} options={VIEWS} value={section} />
      {packLoading && !pack ? (
        <Surface>
          <Placeholder lines={6} />
        </Surface>
      ) : null}
      {!packLoading && !pack ? (
        <Banner tone="attention">
          <Text variant="bodyStrong">Not saved on this phone yet</Text>
          <Text variant="secondary">Connect to the internet and refresh to save the trip pack for offline use.</Text>
          <Button busy={refreshing} label="Save trip pack" onPress={refresh} />
        </Banner>
      ) : null}
      {pack && section === 'roster' ? <Roster pack={pack} /> : null}
      {pack && section === 'schedule' ? <Schedule now={now} pack={pack} /> : null}
      {pack && section === 'contacts' ? <Contacts pack={pack} /> : null}
    </Screen>
  );
}
