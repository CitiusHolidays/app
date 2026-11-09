import { Banner, Button, space, StatusPill, Text } from '@citius/ui';
import { Alert, View } from 'react-native';
import Animated, { FadeIn, LayoutAnimationConfig } from 'react-native-reanimated';

import { useNow } from '@/lib/use-now';

import { syncedLabel, type SyncItem, syncSummary } from './queue';

const SETTLE = FadeIn.duration(200);

/** Asks before giving up on a refused update: the office will not get it unless it changes again. */
function confirmDiscard(onDiscard: () => void) {
  Alert.alert(
    'Stop sending this update?',
    'It stays on this phone, but the office will not get it. If you change it later, the app tries again.',
    [
      { style: 'cancel', text: 'Keep' },
      { onPress: onDiscard, style: 'destructive', text: 'Stop sending' },
    ]
  );
}

/**
 * The office copy, in one small line: "Synced to office 07:12" or "Waiting to sync". A refusal
 * says why and offers a retry, or to stop sending; a partial record says who the office left out.
 */
export function SyncLine({
  ignoredNote,
  items,
  onDiscard,
  onRetry,
}: {
  /** Words for "the office left out N travellers", which differ between a count and a checklist. */
  ignoredNote: (count: number) => string;
  items: SyncItem[];
  onDiscard: (keys: string[]) => void;
  onRetry: (keys: string[]) => void;
}) {
  const now = useNow();
  const summary = syncSummary(items);
  if (summary.kind === 'none') {
    return null;
  }
  if (summary.kind === 'problem') {
    return (
      <Banner tone="danger">
        <Text variant="bodyStrong">Not synced to the office</Text>
        <Text accessibilityLiveRegion="polite" variant="secondary">
          {summary.problem}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          <Button label="Try again" onPress={() => onRetry(summary.keys)} variant="secondary" />
          <Button label="Stop sending" onPress={() => confirmDiscard(() => onDiscard(summary.keys))} variant="secondary" />
        </View>
      </Banner>
    );
  }
  const waiting = summary.kind === 'waiting';
  return (
    <View style={{ gap: space.xs + 2 }}>
      {/* One wrapper for both states: opening the screen shows the pill still, and the change from
          "Waiting to sync" to "Synced" fades the new pill in. */}
      <LayoutAnimationConfig skipEntering>
        <Animated.View entering={SETTLE} key={waiting ? 'waiting' : 'synced'} style={{ alignSelf: 'flex-start' }}>
          {waiting ? <StatusPill kind="neutral" label="Waiting to sync" /> : <StatusPill kind="good" label={syncedLabel(summary.at, now)} />}
        </Animated.View>
      </LayoutAnimationConfig>
      {!waiting && summary.newerOnServer ? (
        <Text tone="muted" variant="secondary">
          The office already had a later update from another phone, so it kept that one.
        </Text>
      ) : null}
      {!waiting && summary.ignored > 0 ? (
        <Text tone="warning" variant="secondary">
          {ignoredNote(summary.ignored)}
        </Text>
      ) : null}
    </View>
  );
}
