import { PressableScale, space, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { DestinationCover } from '@/components/destination-cover';
import { FreshnessStamp } from '@/components/freshness';
import { Icon } from '@/components/kit';
import { useOutbox } from '@/features/expenses/outbox-context';
import { useFieldSync } from '@/features/field-sync/field-sync-context';
import { type WaitingPlace, waitingLabel, waitingWork } from '@/features/field-sync/waiting';
import { useCanReachServer } from '@/features/gate/reach';
import { freshnessLabel } from '@/features/trip-pack/trip-pack';
import { dateKicker, formatDateRange } from '@/lib/dates';

import { TripHeroSkeleton } from './skeletons';
import { phaseLabel } from './trips';
import { tripsPending } from './trips-list';
import { useTrips } from './trips-context';

/** A fact on the photo: white on a dark glass pill, so it reads on any picture. */
function HeroTag({ icon, label, tone = 'plain', trailing }: { icon?: ReactNode; label: string; tone?: 'plain' | 'live' | 'waiting'; trailing?: ReactNode }) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(12,17,36,0.5)',
        borderColor: 'rgba(255,255,255,0.18)',
        borderRadius: 999,
        borderStyle: tone === 'waiting' ? 'dashed' : 'solid',
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        minHeight: 30,
        paddingHorizontal: 12,
      }}
    >
      {tone === 'live' ? <View style={{ backgroundColor: '#86efac', borderRadius: 4, height: 7, width: 7 }} /> : icon}
      <Text numberOfLines={1} style={{ color: '#ffffff' }} tabular variant="label">
        {label}
      </Text>
      {trailing}
    </View>
  );
}

/** Where each kind of waiting work is looked at. */
const PLACES: Record<WaitingPlace, { href: '/headcount' | '/announce' | '/expenses'; name: string }> = {
  announcements: { href: '/announce', name: 'Announcements' },
  expenses: { href: '/expenses', name: 'Expenses' },
  headcount: { href: '/headcount', name: 'Headcount' },
};

/**
 * This trip's work saved on the phone that the office does not have yet, so offline work is never
 * invisible. Tapping it opens the screen where that work is.
 */
function WaitingTag({ jobCardId }: { jobCardId: string }) {
  const sync = useFieldSync();
  const outbox = useOutbox();
  const waiting = waitingWork(sync.items, outbox.items, jobCardId);
  const label = waitingLabel(waiting);
  if (!label || !waiting.place) return null;
  const place = PLACES[waiting.place];
  return (
    <PressableScale
      accessibilityHint={`Opens ${place.name}`}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={{ bottom: 7, top: 7 }}
      onPress={() => router.navigate(place.href)}
    >
      <HeroTag label={label} tone="waiting" trailing={<Icon color="#ffffff" ios="chevron.right" md="chevron_right" size={11} />} />
    </PressableScale>
  );
}

/** The trip's facts as pills on the photo: code, batches, work waiting to send, and freshness. */
function HeroFacts({ jobCardId, jobCode, now }: { jobCardId: string; jobCode: string; now: number }) {
  const canReachServer = useCanReachServer();
  const { pack, packProblem, tripsProblem, tripsSavedAt } = useTrips();
  const savedAt = pack?.savedAt ?? tripsSavedAt;
  const fresh = canReachServer && !(packProblem ?? tripsProblem) && savedAt;
  const batches = pack?.batches.length ?? 0;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 }}>
      <HeroTag label={jobCode} />
      {batches > 0 ? (
        <HeroTag icon={<Icon color="#ffffff" ios="bus" md="directions_bus" size={13} />} label={`${batches} ${batches === 1 ? 'batch' : 'batches'}`} />
      ) : null}
      <WaitingTag jobCardId={jobCardId} />
      {fresh ? <HeroTag label={freshnessLabel(fresh, now).replace('Saved, updated', 'Updated')} tone="live" /> : null}
    </View>
  );
}

/**
 * The opening: the trip on a photo of its destination (cached, so it opens offline), with the date
 * and trip day, the client, the place and dates, and its facts as pills. Offline or failing, the
 * notice under the card says so in words. While the trip list is still coming, a card of the same
 * size holds its place.
 */
export function TripHero({ now }: { now: number }) {
  const theme = useAppTheme();
  const { pack, packProblem, selected, tripsProblem, tripsSavedAt, tripsStatus } = useTrips();
  if (!selected) {
    if (tripsPending(tripsStatus)) return <TripHeroSkeleton />;
    return (
      <View accessible accessibilityRole="header" style={{ gap: space.xs + 2 }}>
        <Text tone="muted" variant="mono">
          {dateKicker(now)}
        </Text>
        <Text variant="display">Today</Text>
      </View>
    );
  }
  const kicker = [dateKicker(now), phaseLabel(selected, now)].join(' · ');
  const title = selected.clientName || selected.jobCode;
  const where = `${selected.destination || 'Destination not set'} · ${formatDateRange(selected.travelStartDate, selected.travelEndDate)}`;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ borderRadius: theme.radius.hero, minHeight: 300, overflow: 'hidden' }}>
        <DestinationCover photo={pack?.cover ?? null} />
        <View style={{ flex: 1, justifyContent: 'space-between', padding: space.lg + 2 }}>
          {/* The words are one heading; the pills under them stay separate, so the waiting one can be tapped. */}
          <View accessibilityLabel={[title, kicker, where].join('. ')} accessibilityRole="header" accessible style={{ flex: 1, justifyContent: 'space-between' }}>
            <Text style={{ color: 'rgba(255,255,255,0.86)' }} variant="mono">
              {kicker}
            </Text>
            <View style={{ gap: space.xs, paddingBottom: space.sm + 2 }}>
              <Text numberOfLines={3} style={{ color: '#ffffff' }} variant="display">
                {title}
              </Text>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.82)' }} variant="secondary">
                {where}
              </Text>
            </View>
          </View>
          <HeroFacts jobCardId={selected.id} jobCode={selected.jobCode} now={now} />
        </View>
      </View>
      <FreshnessStamp part="notice" problem={packProblem ?? tripsProblem} savedAt={pack?.savedAt ?? tripsSavedAt} />
    </View>
  );
}
