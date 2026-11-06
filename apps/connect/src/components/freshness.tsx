import { Banner, Text } from '@citius/ui';

import { useStaffSession } from '@/features/gate/session';
import { freshnessLabel } from '@/features/trip-pack/trip-pack';
import { useNow } from '@/lib/use-now';

/** "Saved, updated 07:12", plus an offline notice when the device has no connection. */
export function FreshnessStamp({ problem, savedAt }: { problem?: string | null; savedAt: number | null }) {
  const { gate, online } = useStaffSession();
  const now = useNow();
  const offline = !online || (gate.kind === 'staff' && gate.offline);
  if (!savedAt && !offline && !problem) {
    return null;
  }
  return (
    <Banner tone={offline || problem ? 'attention' : 'neutral'}>
      {offline ? <Text variant="bodyStrong">Offline. Showing what is saved on this phone.</Text> : null}
      {problem ? <Text variant="secondary">{problem}</Text> : null}
      {savedAt ? (
        <Text variant="meta" tabular tone="muted">
          {freshnessLabel(savedAt, now)}
        </Text>
      ) : null}
    </Banner>
  );
}
