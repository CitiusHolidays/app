import { Banner, face, PressableScale, space, StatusPill, Surface, Text, useAppTheme } from '@citius/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Avatar, Chip, ChipRow, EveryoneSeal, Icon, ListCard, QuietState, Screen, Segmented, StepNumber, TickStrip } from '@/components/kit';
import { useFieldSync } from '@/features/field-sync/field-sync-context';
import { headcountStopPush } from '@/features/field-sync/pushes';
import { syncKey } from '@/features/field-sync/queue';
import { SyncLine } from '@/features/field-sync/sync-line';
import {
  earlierStops,
  type HeadcountState,
  type HeadcountSummary,
  headcountAnswer,
  nobodyTravelling,
  PARTIAL_ROSTER_NOTICE,
  summarize,
} from '@/features/headcount/headcount';
import { EVERYONE, type HeadcountFilter, type HeadcountView, type Show, viewRoster } from '@/features/headcount/headcount-filter';
import { HeroSkeleton, RowsSkeleton } from '@/features/headcount/headcount-skeleton';
import { EarlierStops, NextStop } from '@/features/headcount/next-stop';
import { useHeadcount } from '@/features/headcount/use-headcount';
import type { RosterEntry, TripPack } from '@/features/trip-pack/trip-pack';
import { useTrips } from '@/features/trips/trips-context';
import { haptic, tick } from '@/lib/haptics';
import { useAnnounce } from '@/lib/use-announce';
import { useLingering } from '@/lib/use-lingering';
import { useProgressiveCount } from '@/lib/use-progressive-count';
import { CLOSE_UP, ROW_OUT } from '@/lib/motion';

const SHOW_OPTIONS: { label: string; value: Show }[] = [
  { label: 'All', value: 'all' },
  { label: 'Not marked', value: 'missing' },
];

const ignoredNote = (count: number) =>
  `${count} marked ${count === 1 ? 'traveller is' : 'travellers are'} not in your group on the office list, so the office did not count them. Refresh the trip pack.`;

/** The answer at the top: how many are here at this stop, out of how many. */
function HeadcountHero({ answer, summary }: { answer: string; summary: HeadcountSummary }) {
  const theme = useAppTheme();
  const everyone = answer.startsWith('All');
  return (
    <Surface style={{ gap: space.lg }} variant="hero">
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm, justifyContent: 'space-between' }}>
        <Text numberOfLines={1} style={{ flexShrink: 1 }} variant="label">
          Headcount · {summary.stopLabel}
        </Text>
        <Icon color={theme.color.muted} ios="person.3" md="groups" size={18} />
      </View>
      <View accessibilityLabel={answer} accessibilityLiveRegion="polite" accessible style={{ gap: space.md }}>
        <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 6 }}>
          <StepNumber value={everyone ? 'All' : String(summary.present)} />
          <Text style={face(theme, 'medium')} tabular tone="muted" variant="section">
            {everyone ? `${summary.expected} here` : `/ ${summary.expected} here`}
          </Text>
          <EveryoneSeal shown={everyone} />
        </View>
        <TickStrip marked={summary.present} total={summary.expected} />
      </View>
      <Text tabular tone="muted" variant="secondary">
        {summary.missing.length === 0 ? 'Nobody left to mark' : `${summary.missing.length} not marked yet`}
      </Text>
    </Surface>
  );
}

/** One traveller to tap: here, or not marked yet. */
function TravellerRow({ entry, here, last, onPress }: { entry: RosterEntry; here: boolean; last: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const meta = [entry.batchLabel, entry.guestType].filter(Boolean).join(' · ');
  return (
    <PressableScale accessibilityLabel={entry.name} accessibilityRole="checkbox" accessibilityState={{ checked: here }} onPress={onPress}>
      <View style={[styles.row, { borderBottomColor: theme.color.rule, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
        <Avatar checked={here} name={entry.name} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} variant="rowTitle">
            {entry.name}
          </Text>
          {meta ? (
            <Text numberOfLines={1} tone="muted" variant="secondary">
              {meta}
            </Text>
          ) : null}
        </View>
        <StatusPill kind={here ? 'good' : 'neutral'} label={here ? 'Here' : 'Not marked'} />
      </View>
    </PressableScale>
  );
}

/**
 * Tap each traveller who is here. Works offline: marks stay on this phone for today, and each
 * stop is sent to the office whenever there is a connection.
 */
export default function Headcount() {
  const { pack, selected } = useTrips();
  const headcount = useHeadcount(selected?.id ?? null);
  const { state } = headcount;
  if (!pack || !state) {
    return <NothingToCount text="Save the trip pack first (Trip tab), then take a headcount." />;
  }
  if (nobodyTravelling(pack.roster)) {
    return (
      <NothingToCount
        partial={!pack.complete}
        text="Nobody on this trip is travelling, so there is no one to count. Refresh the trip pack (Trip tab) once Operations adds travellers."
      />
    );
  }
  return <Count headcount={headcount} pack={pack} state={state} />;
}

/** Why there is no list to mark yet, and what to do about it. */
function NothingToCount({ partial = false, text }: { partial?: boolean; text: string }) {
  return (
    <Screen tabBar={false}>
      <Surface>
        <QuietState text={text} />
      </Surface>
      {partial ? <PartialNotice /> : null}
    </Screen>
  );
}

function PartialNotice() {
  return (
    <Banner tone="attention">
      <Text variant="secondary">{PARTIAL_ROSTER_NOTICE}</Text>
    </Banner>
  );
}

/** The count for a trip with travellers: the answer, the filters, and the list to mark. */
function Count({
  headcount: { loaded, newStop, toggle },
  pack,
  state: current,
}: {
  headcount: ReturnType<typeof useHeadcount>;
  pack: TripPack;
  state: HeadcountState;
}) {
  const sync = useFieldSync();
  /** Queues the stop that just changed (always the current one) for the office. */
  const send = (next: HeadcountState | null) => {
    const stop = next?.stops.at(-1);
    if (next && stop) sync.enqueue(headcountStopPush(next, stop));
  };
  const [filter, setFilter] = useState<HeadcountFilter>(EVERYONE);
  // In "Not marked", a row someone just marked stays put for a moment showing "Here", then leaves.
  const { hold, held } = useLingering();
  const present = new Set(current.stops.at(-1)?.present ?? []);
  const view = viewRoster(pack, filter, present, held);
  const summary = summarize(current, pack.roster, view.batch?.id);
  const answer = loaded ? headcountAnswer(summary, pack) : null;
  useAnnounce(answer);
  // A large group draws its first screens at once and fills in over the next few frames.
  const shown = useProgressiveCount(pack.roster.length);
  const todaysKeys = new Set(current.stops.map((stop) => syncKey(headcountStopPush(current, stop))));
  const whole = summarize(current, pack.roster);

  const mark = (entry: RosterEntry) => {
    const wasLast = !present.has(entry.id) && summary.missing.length === 1 && summary.missing[0]?.id === entry.id;
    send(toggle(entry.id));
    if (filter.show === 'missing') hold(entry.id);
    if (wasLast) haptic('success');
    else tick();
  };

  return (
    <Screen tabBar={false}>
      {answer ? <HeadcountHero answer={answer} summary={summary} /> : <HeroSkeleton />}
      {loaded ? (
        <SyncLine
          ignoredNote={ignoredNote}
          items={sync.items.filter((item) => todaysKeys.has(item.key))}
          onDiscard={sync.discard}
          onRetry={sync.retry}
        />
      ) : null}
      {pack.complete ? null : <PartialNotice />}
      <BatchChips
        batches={pack.batches}
        chosen={view.batch?.id ?? null}
        onChoose={(batchId) => setFilter((previous) => ({ ...previous, batchId }))}
      />
      <Segmented label="Show" onChange={(show) => setFilter((previous) => ({ ...previous, show }))} options={SHOW_OPTIONS} value={filter.show} />
      {loaded ? (
        <>
          <TravellerList onToggle={mark} present={present} show={filter.show} shown={shown} view={view} />
          <NextStop current={{ answer: headcountAnswer(whole, pack), label: whole.stopLabel }} onStart={(name) => send(newStop(name))} />
          <EarlierStops stops={earlierStops(current, pack.roster, pack.complete)} />
        </>
      ) : (
        <RowsSkeleton rows={view.people.length} />
      )}
    </Screen>
  );
}

/** Narrows the count to one travel batch. Hidden when the trip has no batches. */
function BatchChips({
  batches,
  chosen,
  onChoose,
}: {
  batches: TripPack['batches'];
  chosen: string | null;
  onChoose: (batchId: string | null) => void;
}) {
  if (batches.length === 0) return null;
  return (
    <ChipRow label="Travel batch">
      <Chip label="Everyone" onPress={() => onChoose(null)} selected={chosen === null} />
      {batches.map((batch) => (
        <Chip key={batch.id} label={batch.label} onPress={() => onChoose(batch.id)} selected={chosen === batch.id} />
      ))}
    </ChipRow>
  );
}

/** The travellers to mark (the first `shown` of them while a large group draws), or why there are none. */
function TravellerList({
  onToggle,
  present,
  show,
  shown,
  view,
}: {
  onToggle: (entry: RosterEntry) => void;
  present: ReadonlySet<string>;
  show: Show;
  shown: number;
  view: HeadcountView;
}) {
  const reduced = useReducedMotion();
  if (view.empty) {
    return (
      <Surface>
        <QuietState good={view.empty.good} text={view.empty.text} />
      </Surface>
    );
  }
  const rows = view.people.slice(0, shown);
  // Only "Not marked" removes rows; there, a leaving row fades and the rows below close the gap.
  // The full list never animates its rows: it is read, not changed. Reduced motion: no movement.
  const animated = show === 'missing' && !reduced;
  return (
    <ListCard>
      {rows.map((entry, index) => (
        <Animated.View exiting={animated ? ROW_OUT : undefined} key={entry.id} layout={animated ? CLOSE_UP : undefined}>
          <TravellerRow entry={entry} here={present.has(entry.id)} last={index === rows.length - 1} onPress={() => onToggle(entry)} />
        </Animated.View>
      ))}
    </ListCard>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 64, paddingVertical: space.md },
});
