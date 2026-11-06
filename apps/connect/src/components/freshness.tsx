import { Banner, StatusPill, Text } from '@citius/ui';

import { useStaffSession } from '@/features/gate/session';
import { freshnessLabel } from '@/features/trip-pack/trip-pack';
import { useNow } from '@/lib/use-now';

/**
 * Online and fresh, a small live pill ("Saved, updated 07:12"). Offline or failing, a notice that
 * says so in words, since the tour manager must not mistake a saved copy for live data.
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
  if (!savedAt && !offline && !problem) {
    return null;
  }
  if (!offline && !problem && savedAt) {
    if (part === 'notice') return null;
    return <StatusPill kind="live" label={part === 'pill' ? freshnessLabel(savedAt, now).replace('Saved, updated', 'Updated') : freshnessLabel(savedAt, now)} />;
  }
  if (part === 'pill') {
    return null;
  }
  return (
    <Banner tone="attention">
      {offline ? <Text variant="bodyStrong">Offline. Showing what is saved on this phone.</Text> : null}
      {problem ? <Text variant="secondary">{problem}</Text> : null}
      {savedAt ? (
        <Text variant="meta" tabular tone="warning">
          {freshnessLabel(savedAt, now)}
        </Text>
      ) : null}
    </Banner>
  );
}
