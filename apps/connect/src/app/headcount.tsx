import { Banner, Button, face, PressableScale, space, StatusPill, Surface, Text, useAppTheme } from '@citius/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Avatar, Chip, ChipRow, EveryoneSeal, Icon, ListCard, QuietState, Screen, Segmented, StepNumber, TextField, TickStrip } from '@/components/kit';
import { useFieldSync } from '@/features/field-sync/field-sync-context';
import { headcountStopPush } from '@/features/field-sync/pushes';
import { syncKey } from '@/features/field-sync/queue';
import { SyncLine } from '@/features/field-sync/sync-line';
import { type HeadcountState, type HeadcountSummary, headcountAnswer, PARTIAL_ROSTER_NOTICE, summarize } from '@/features/headcount/headcount';
import { useHeadcount } from '@/features/headcount/use-headcount';
import type { RosterEntry } from '@/features/trip-pack/trip-pack';
import { useTrips } from '@/features/trips/trips-context';
import { haptic, tick } from '@/lib/haptics';
import { useAnnounce } from '@/lib/use-announce';
import { useLingering } from '@/lib/use-lingering';
import { useProgressiveCount } from '@/lib/use-progressive-count';
import { CLOSE_UP, ROW_OUT } from '@/lib/motion';

type Show = 'all' | 'missing';

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

/** Names a fresh stop and starts counting again from nobody. */
function NextStop({ onStart }: { onStart: (name: string) => void }) {
  const [stopName, setStopName] = useState('');
  const start = () => {
    onStart(stopName);
    setStopName('');
  };
  return (
    <Surface style={{ gap: space.md }}>
      <TextField
        hint="Starts a fresh count. Earlier stops stay in today's record."
        label="Next stop"
        onChangeText={setStopName}
        // The keyboard's own Go key starts the stop, so the button under the keyboard is optional.
        onSubmitEditing={start}
        placeholder="For example: Temple car park"
        returnKeyType="go"
        value={stopName}
      />
      <Button
        icon={<Icon ios="arrow.right" md="arrow_forward" size={15} />}
        label="Start new stop"
        onPress={start}
        variant="secondary"
      />
    </Surface>
  );
}

/**
 * Tap each traveller who is here. Works offline: marks stay on this phone for today, and each
 * stop is sent to the office whenever there is a connection.
 */
export default function Headcount() {
  const { pack, selected } = useTrips();
  const { newStop, state, toggle } = useHeadcount(selected?.id ?? null);
  const sync = useFieldSync();
  /** Queues the stop that just changed (always the current one) for the office. */
  const send = (next: HeadcountState | null) => {
    const stop = next?.stops.at(-1);
    if (next && stop) sync.enqueue(headcountStopPush(next, stop));
  };
  const [batchId, setBatchId] = useState<string | undefined>(undefined);
  const [show, setShow] = useState<Show>('all');
  // In "Not marked", a row someone just marked stays put for a moment showing "Here", then leaves.
  const { hold, held } = useLingering();
  const summary = pack && state ? summarize(state, pack.roster, batchId) : null;
  const answer = summary && pack ? headcountAnswer(summary, pack) : null;
  useAnnounce(answer);
  // A large group draws its first screens at once and fills in over the next few frames.
  const shown = useProgressiveCount(pack?.roster.length ?? 0);

  if (!pack || !state || !summary || !answer) {
    return (
      <Screen tabBar={false}>
        <Surface>
          <QuietState text="Save the trip pack first (Trip tab), then take a headcount." />
        </Surface>
      </Screen>
    );
  }
  const present = new Set(state.stops.at(-1)?.present ?? []);
  const todaysKeys = new Set(state.stops.map((stop) => syncKey(headcountStopPush(state, stop))));
  const syncItems = sync.items.filter((item) => todaysKeys.has(item.key));
  const people = pack.roster.filter(
    (entry) => entry.travelling && (!batchId || entry.batchId === batchId) && (show === 'all' || !present.has(entry.id) || held.has(entry.id))
  );

  return (
    <Screen tabBar={false}>
      <HeadcountHero answer={answer} summary={summary} />
      <SyncLine ignoredNote={ignoredNote} items={syncItems} onRetry={sync.retry} />
      {pack.complete ? null : (
        <Banner tone="attention">
          <Text variant="secondary">{PARTIAL_ROSTER_NOTICE}</Text>
        </Banner>
      )}
      {pack.batches.length > 0 ? (
        <ChipRow label="Travel batch">
          <Chip label="Everyone" onPress={() => setBatchId(undefined)} selected={!batchId} />
          {pack.batches.map((batch) => (
            <Chip key={batch.id} label={batch.label} onPress={() => setBatchId(batch.id)} selected={batchId === batch.id} />
          ))}
        </ChipRow>
      ) : null}
      <Segmented label="Show" onChange={setShow} options={SHOW_OPTIONS} value={show} />
      <TravellerList
        onToggle={(entry) => {
          const wasLast = !present.has(entry.id) && summary.missing.length === 1 && summary.missing[0]?.id === entry.id;
          send(toggle(entry.id));
          if (show === 'missing') hold(entry.id);
          if (wasLast) haptic('success');
          else tick();
        }}
        people={people}
        present={present}
        show={show}
        shown={shown}
      />
      <NextStop onStart={(name) => send(newStop(name))} />
    </Screen>
  );
}

/** The travellers to mark (the first `shown` of them while a large group draws), or why there are none. */
function TravellerList({
  onToggle,
  people,
  present,
  show,
  shown,
}: {
  onToggle: (entry: RosterEntry) => void;
  people: RosterEntry[];
  present: ReadonlySet<string>;
  show: Show;
  shown: number;
}) {
  const reduced = useReducedMotion();
  if (people.length === 0) {
    return (
      <Surface>
        <QuietState good={show === 'missing'} text={show === 'missing' ? 'Everyone here is marked.' : 'Nobody in this batch is travelling.'} />
      </Surface>
    );
  }
  const rows = people.slice(0, shown);
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
