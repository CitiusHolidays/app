import { Banner, Button, Text } from '@citius/ui';

import { useTrips } from '@/features/trips/trips-context';

import type { PackStatus } from './pack-status';

type Missing = Extract<PackStatus, { kind: 'none' | 'failed' | 'off' }>['kind'];

const WORDS: Record<Missing, { body: { offline?: string; online: string }; title: string }> = {
  failed: {
    body: { offline: 'Connect to the internet, then try again.', online: 'Check the connection, then try again.' },
    title: 'Could not save the trip pack',
  },
  none: {
    body: {
      offline: 'Connect to the internet once to save the roster, schedule and contacts for offline use.',
      online: 'Save it now so the roster, schedule and contacts open without signal.',
    },
    title: 'No trip pack on this phone yet',
  },
  off: {
    body: { online: 'Operations stopped the app for this trip, so nothing about it is kept on this phone.' },
    title: 'This trip is not live in the app any more',
  },
};

/**
 * Why the selected trip has no pack on the phone, with the one action that fixes it. Shared by
 * Today and Trip, so both say the same thing. Offline the button says what it needs instead of
 * doing nothing; the download itself shows as the screen's placeholder.
 */
export function PackMissing({ kind }: { kind: Missing }) {
  const { canRefresh, refreshPack } = useTrips();
  const words = WORDS[kind];
  return (
    <Banner tone="attention">
      <Text variant="bodyStrong">{words.title}</Text>
      <Text variant="secondary">{canRefresh ? words.body.online : (words.body.offline ?? words.body.online)}</Text>
      {kind === 'off' ? null : (
        <Button
          disabled={!canRefresh}
          label={canRefresh ? (kind === 'failed' ? 'Try again' : 'Save trip pack') : 'Connect to save'}
          onPress={() => void refreshPack()}
        />
      )}
    </Banner>
  );
}
