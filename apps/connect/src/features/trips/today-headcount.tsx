import { Button, face, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Arrive, Avatar, EveryoneSeal, Icon, QuietState, StepNumber, TickStrip } from '@/components/kit';
import { headcountAnswer, nobodyTravelling, PARTIAL_ROSTER_NOTICE, summarize } from '@/features/headcount/headcount';
import { useHeadcount } from '@/features/headcount/use-headcount';
import { PackMissing } from '@/features/trip-pack/pack-missing';
import type { TripPack } from '@/features/trip-pack/trip-pack';

import { HeadcountSkeleton } from './skeletons';
import { tripsPending } from './trips-list';
import { useTrips } from './trips-context';

const MISSING_SHOWN = 5;
const NOBODY_TRAVELLING = 'Nobody on this trip is travelling, so there is no one to count. Pull down to refresh the trip pack once Operations adds travellers.';

function CardLabel({ text }: { text: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="label">{text}</Text>
      <Icon color={theme.color.muted} ios="person.3" md="groups" size={18} />
    </View>
  );
}

/** The count over the saved roster: "38 / 41 here", the ticks, and who is still to mark. */
function Count({ jobCardId, pack }: { jobCardId: string; pack: TripPack }) {
  const theme = useAppTheme();
  const { loaded, state } = useHeadcount(jobCardId);
  // Nobody to count: "Everyone is marked" would be true of no one. Same words as the Headcount screen.
  if (nobodyTravelling(pack.roster)) {
    return (
      <Arrive>
        <Surface style={{ gap: space.lg }} variant="hero">
          <CardLabel text="Headcount" />
          <QuietState text={NOBODY_TRAVELLING} />
          {pack.complete ? null : (
            <Text tone="warning" variant="secondary">
              {PARTIAL_ROSTER_NOTICE}
            </Text>
          )}
        </Surface>
      </Arrive>
    );
  }
  // Until today's record is read, a fresh start would show a false "0 / 41".
  if (!loaded || !state) return <HeadcountSkeleton />;
  const summary = summarize(state, pack.roster);
  const answer = headcountAnswer(summary, pack);
  const everyone = answer.startsWith('All');
  const missingShown = summary.missing.slice(0, MISSING_SHOWN);
  const more = summary.missing.length - missingShown.length;
  return (
    <Arrive>
      <Surface style={{ gap: space.lg }} variant="hero">
        <CardLabel text={`Headcount · ${summary.stopLabel}`} />
        <View accessible accessibilityLabel={`${answer} at ${summary.stopLabel}`} style={{ gap: space.md }}>
          <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 6 }}>
            <StepNumber value={everyone ? 'All' : String(summary.present)} />
            <Text tabular tone="muted" variant="section" style={face(theme, 'medium')}>
              {everyone ? `${summary.expected} here` : `/ ${summary.expected} here`}
            </Text>
            <EveryoneSeal shown={everyone} />
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
    </Arrive>
  );
}

/**
 * The screen's answer: "Is everyone here, and who isn't?" One tick per traveller. While the trip
 * or its pack is still coming, a card of the same size holds its place; without a pack, it says
 * why and offers to save one.
 */
export function HeadcountCard() {
  const { packStatus, selected, tripsStatus } = useTrips();
  if (!selected) {
    return tripsPending(tripsStatus) ? <HeadcountSkeleton /> : null;
  }
  switch (packStatus.kind) {
    case 'loading':
    case 'fetching':
      return <HeadcountSkeleton />;
    case 'none':
    case 'failed':
    case 'off':
      return <PackMissing kind={packStatus.kind} />;
    case 'ready':
    case 'stale':
      return <Count jobCardId={selected.id} pack={packStatus.pack} />;
  }
}
