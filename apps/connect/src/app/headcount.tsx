import { Button, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, ChipRow, haptic, Screen, TextField } from '@/components/kit';
import { headcountAnswer, PARTIAL_ROSTER_NOTICE, summarize } from '@/features/headcount/headcount';
import { useHeadcount } from '@/features/headcount/use-headcount';
import { useTrips } from '@/features/trips/trips-context';
import { useAnnounce } from '@/lib/use-announce';

/** Tap each traveller who is here. Works offline; marks stay on this phone for today. */
export default function Headcount() {
  const theme = useAppTheme();
  const { pack, selected } = useTrips();
  const { newStop, state, toggle } = useHeadcount(selected?.id ?? null);
  const [batchId, setBatchId] = useState<string | undefined>(undefined);
  const [missingOnly, setMissingOnly] = useState(false);
  const [stopName, setStopName] = useState('');
  const summary = pack && state ? summarize(state, pack.roster, batchId) : null;
  const answer = summary && pack ? headcountAnswer(summary, pack) : null;
  useAnnounce(answer);

  if (!pack || !state || !summary) {
    return (
      <Screen>
        <Text tone="muted">Save the trip pack first (Trip tab), then take a headcount.</Text>
      </Screen>
    );
  }
  const present = new Set(state.stops.at(-1)?.present ?? []);
  const people = pack.roster.filter(
    (entry) => entry.travelling && (!batchId || entry.batchId === batchId) && (!missingOnly || !present.has(entry.id))
  );

  return (
    <Screen>
      <View accessibilityLiveRegion="polite" accessible>
        <Text variant="answer" tabular>
          {answer}
        </Text>
        <Text variant="secondary" tone="muted">
          {summary.stopLabel} · {summary.missing.length} not marked
        </Text>
      </View>
      {pack.complete ? null : (
        <Text tone="warning" variant="secondary">
          {PARTIAL_ROSTER_NOTICE}
        </Text>
      )}
      {pack.batches.length > 0 ? (
        <ChipRow label="Travel batch">
          <Chip label="Everyone" onPress={() => setBatchId(undefined)} selected={!batchId} />
          {pack.batches.map((batch) => (
            <Chip key={batch.id} label={batch.label} onPress={() => setBatchId(batch.id)} selected={batchId === batch.id} />
          ))}
        </ChipRow>
      ) : null}
      <ChipRow label="Show">
        <Chip label="All" onPress={() => setMissingOnly(false)} selected={!missingOnly} />
        <Chip label="Not marked" onPress={() => setMissingOnly(true)} selected={missingOnly} />
      </ChipRow>
      <View>
        {people.map((entry) => {
          const here = present.has(entry.id);
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
              <View style={[styles.row, { borderBottomColor: theme.color.border, minHeight: theme.minTarget }]}>
                <View
                  style={[
                    styles.box,
                    {
                      backgroundColor: here ? theme.color.success : theme.color.surface,
                      borderColor: here ? theme.color.success : theme.color.controlBorder,
                    },
                  ]}
                >
                  {here ? (
                    <Text variant="bodyStrong" tone="onPrimary">
                      ✓
                    </Text>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{entry.name}</Text>
                  <Text variant="secondary" tone="muted">
                    {[entry.batchLabel, entry.guestType].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text variant="meta" tone={here ? 'success' : 'warning'}>
                  {here ? 'Here' : 'Not marked'}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
      <Surface style={{ gap: space.sm }}>
        <TextField
          hint="Starts a fresh count. Earlier stops stay in today's record."
          label="Next stop"
          onChangeText={setStopName}
          placeholder="For example: Temple car park"
          value={stopName}
        />
        <Button
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
  box: { alignItems: 'center', borderRadius: 6, borderWidth: 2, height: 28, justifyContent: 'center', width: 28 },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
});
