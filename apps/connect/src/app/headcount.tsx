import { Banner, Button, face, PressableScale, space, StatusPill, Surface, Text, useAppTheme } from '@citius/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Chip, ChipRow, haptic, Icon, ListCard, QuietState, Screen, Segmented, TextField, TickStrip } from '@/components/kit';
import { headcountAnswer, PARTIAL_ROSTER_NOTICE, summarize } from '@/features/headcount/headcount';
import { useHeadcount } from '@/features/headcount/use-headcount';
import { useTrips } from '@/features/trips/trips-context';
import { useAnnounce } from '@/lib/use-announce';

type Show = 'all' | 'missing';

/** Tap each traveller who is here. Works offline; marks stay on this phone for today. */
export default function Headcount() {
  const theme = useAppTheme();
  const { pack, selected } = useTrips();
  const { newStop, state, toggle } = useHeadcount(selected?.id ?? null);
  const [batchId, setBatchId] = useState<string | undefined>(undefined);
  const [show, setShow] = useState<Show>('all');
  const [stopName, setStopName] = useState('');
  const summary = pack && state ? summarize(state, pack.roster, batchId) : null;
  const answer = summary && pack ? headcountAnswer(summary, pack) : null;
  useAnnounce(answer);

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
  const people = pack.roster.filter(
    (entry) => entry.travelling && (!batchId || entry.batchId === batchId) && (show === 'all' || !present.has(entry.id))
  );
  const everyone = answer.startsWith('All');

  return (
    <Screen tabBar={false}>
      <Surface style={{ gap: space.lg }} variant="hero">
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm, justifyContent: 'space-between' }}>
          <Text numberOfLines={1} style={{ flexShrink: 1 }} variant="label">
            Headcount · {summary.stopLabel}
          </Text>
          <Icon color={theme.color.muted} ios="person.3" md="groups" size={18} />
        </View>
        <View accessibilityLabel={answer} accessibilityLiveRegion="polite" accessible style={{ gap: space.md }}>
          <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 6 }}>
            <Text tabular variant="answer">
              {everyone ? 'All' : summary.present}
            </Text>
            <Text style={face(theme, 'medium')} tabular tone="muted" variant="section">
              {everyone ? `${summary.expected} here` : `/ ${summary.expected} here`}
            </Text>
          </View>
          <TickStrip marked={summary.present} total={summary.expected} />
        </View>
        <Text tabular tone="muted" variant="secondary">
          {summary.missing.length === 0 ? 'Nobody left to mark' : `${summary.missing.length} not marked yet`}
        </Text>
      </Surface>
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
      <Segmented
        label="Show"
        onChange={setShow}
        options={[
          { label: 'All', value: 'all' },
          { label: 'Not marked', value: 'missing' },
        ]}
        value={show}
      />
      {people.length === 0 ? (
        <Surface>
          <QuietState good={show === 'missing'} text={show === 'missing' ? 'Everyone here is marked.' : 'Nobody in this batch is travelling.'} />
        </Surface>
      ) : (
        <ListCard>
          {people.map((entry, index) => {
            const here = present.has(entry.id);
            const meta = [entry.batchLabel, entry.guestType].filter(Boolean).join(' · ');
            return (
              <PressableScale
                accessibilityLabel={entry.name}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: here }}
                key={entry.id}
                onPress={() => {
                  const wasLast = !here && summary.missing.length === 1 && summary.missing[0]?.id === entry.id;
                  toggle(entry.id);
                  if (wasLast) haptic('success');
                }}
              >
                <View
                  style={[
                    styles.row,
                    { borderBottomColor: theme.color.rule, borderBottomWidth: index === people.length - 1 ? 0 : StyleSheet.hairlineWidth },
                  ]}
                >
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
          })}
        </ListCard>
      )}
      <Surface style={{ gap: space.md }}>
        <TextField
          hint="Starts a fresh count. Earlier stops stay in today's record."
          label="Next stop"
          onChangeText={setStopName}
          placeholder="For example: Temple car park"
          value={stopName}
        />
        <Button
          icon={<Icon ios="arrow.right" md="arrow_forward" size={15} />}
          label="Start new stop"
          onPress={() => {
            newStop(stopName);
            setStopName('');
          }}
          variant="secondary"
        />
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 64, paddingVertical: space.md },
});
