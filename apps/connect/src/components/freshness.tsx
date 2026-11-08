import { Banner, StatusPill, Text } from '@citius/ui';
import type { ReactNode } from 'react';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { useStaffSession } from '@/features/gate/session';
import { freshnessLabel } from '@/features/trip-pack/trip-pack';
import { useNow } from '@/lib/use-now';
import { NOTICE_IN, NOTICE_OUT } from '@/lib/motion';

/**
 * What the stamp shows: nothing, the fresh pill, or the offline/problem notice. The notice fades in
 * when signal drops (200 ms) and out when it returns (150 ms); opening a screen already offline
 * shows it still. The wrapper stays mounted so the fade-out can play.
 */
function Slot({ children }: { children: ReactNode }) {
  return <LayoutAnimationConfig skipEntering>{children}</LayoutAnimationConfig>;
}

/** The offline or problem notice, in words: the tour manager must not mistake a saved copy for live data. */
function Notice({ offline, problem, savedAt, now }: { now: number; offline: boolean; problem?: string | null; savedAt: number | null }) {
  return (
    <Animated.View entering={NOTICE_IN} exiting={NOTICE_OUT}>
      <Banner tone="attention">
        {offline ? <Text variant="bodyStrong">Offline. Showing what is saved on this phone.</Text> : null}
        {problem ? <Text variant="secondary">{problem}</Text> : null}
        {savedAt ? (
          <Text variant="meta" tabular tone="warning">
            {freshnessLabel(savedAt, now)}
          </Text>
        ) : null}
      </Banner>
    </Animated.View>
  );
}

/**
 * Online and fresh, a small live pill ("Saved, updated 07:12"). Offline or failing, a notice that
 * says so in words.
 */
export function FreshnessStamp({
  part,
  problem,
  savedAt,
}: {
  /** 'pill': only the fresh state, for a chip row. 'notice': only the offline/problem notice. */
  part?: 'pill' | 'notice';
  problem?: string | null;
  savedAt: number | null;
}) {
  const { gate, online } = useStaffSession();
  const now = useNow();
  const offline = !online || (gate.kind === 'staff' && gate.offline);
  const trouble = offline || Boolean(problem);
  const showPill = !trouble && savedAt !== null && part !== 'notice';
  const pillLabel = savedAt === null ? '' : freshnessLabel(savedAt, now);
  return (
    <Slot>
      {showPill ? <StatusPill kind="live" label={part === 'pill' ? pillLabel.replace('Saved, updated', 'Updated') : pillLabel} /> : null}
      {trouble && part !== 'pill' ? <Notice now={now} offline={offline} problem={problem} savedAt={savedAt} /> : null}
    </Slot>
  );
}
