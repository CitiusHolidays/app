import type { TripSummary } from '@citius/backend/customer';
import { PressableScale, space, Text, useAppTheme } from '@citius/ui';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DestinationCover } from '@/components/destination-cover';
import { Icon } from '@/components/kit';
import { TEXT_SWAP_IN } from '@/components/motion';
import { datesAndNights, timingText } from '@/features/trips/labels';
import { tripTiming } from '@/features/trips/model';
import { useI18n } from '@/i18n/i18n';

function GlassPill({ label, tone = 'light' }: { label: string; tone?: 'light' | 'live' }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderRadius: theme.radius.chip,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      {tone === 'live' ? (
        <View style={{ backgroundColor: '#f58220', borderRadius: 4, height: 8, width: 8 }} />
      ) : (
        <Icon color={theme.color.warning} ios="airplane" md="flight" size={13} />
      )}
      <Text numberOfLines={1} style={{ color: theme.color.warning }} variant="label">
        {label}
      </Text>
    </View>
  );
}

/**
 * A trip as its destination: the photo edge to edge, the timing in a pill at the top, and the
 * destination, dates and party over the darkened foot of the photo. The lead card is taller.
 */
export function TripCard({ lead, now, onPress, trip }: { lead?: boolean; now: number; onPress: () => void; trip: TripSummary }) {
  const theme = useAppTheme();
  const i18n = useI18n();
  const timing = tripTiming(trip, now);
  const past = trip.phase === 'past';
  const pill = past ? i18n.t('phase.past') : timingText(i18n, timing);
  const people = [
    trip.travellerName ? i18n.t('trip.you', { name: trip.travellerName }) : null,
    trip.minorCount > 0 ? i18n.tn('journeys.withChildren', trip.minorCount) : null,
  ].filter(Boolean);
  const progress = timing.kind === 'progress' ? timing.day / timing.total : null;
  return (
    <PressableScale
      accessibilityLabel={[trip.destination, datesAndNights(i18n, trip), pill, trip.groupName].join(', ')}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: theme.color.dark,
        borderRadius: theme.radius.hero,
        height: lead ? 460 : 300,
        overflow: 'hidden',
      }}
    >
      <DestinationCover photo={trip.cover} priority={lead ? 'high' : 'low'} />
      <View style={{ flex: 1, justifyContent: 'space-between', padding: lead ? space.xl : space.lg + 4 }}>
        <GlassPill label={pill} tone={trip.phase === 'ongoing' ? 'live' : 'light'} />
        <View style={{ gap: space.sm }}>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.78)' }} variant="secondary">
            {trip.groupName}
          </Text>
          <Text numberOfLines={2} style={lead ? { fontSize: 44, lineHeight: 48 } : undefined} tone="onDark" variant="display">
            {trip.destination}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.82)' }} variant="secondary">
            {datesAndNights(i18n, trip)}
          </Text>
          {progress !== null ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 3, height: 5, marginTop: space.xs, overflow: 'hidden' }}>
              <View style={{ backgroundColor: '#b5d439', borderRadius: 3, height: 5, width: `${Math.round(progress * 100)}%` }} />
            </View>
          ) : null}
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.md, paddingTop: space.xs }}>
            <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.72)', flex: 1 }} variant="label">
              {people.join(' · ')}
            </Text>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: 'rgba(11,16,38,0.55)',
                borderColor: 'rgba(255,255,255,0.35)',
                borderRadius: 24,
                borderWidth: 1,
                height: 48,
                justifyContent: 'center',
                width: 48,
              }}
            >
              <Icon color="#ffffff" ios="chevron.right" md="chevron_right" size={18} />
            </View>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

/** "Updated 07:12", with an offline note when the phone cannot reach Citius. */
export function Freshness({ offline, savedAt }: { offline: boolean; savedAt: number | null }) {
  const { t, time } = useI18n();
  const theme = useAppTheme();
  if (!offline && savedAt === null) return null;
  // Going offline, or saved data arriving, swaps the line in place (a 4pt rise over 150ms).
  return (
    <Animated.View
      accessible
      entering={TEXT_SWAP_IN}
      key={offline ? 'offline' : 'saved'}
      style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}
    >
      <Icon color={offline ? theme.color.warning : theme.color.muted} ios={offline ? 'wifi.slash' : 'checkmark.icloud'} md={offline ? 'wifi_off' : 'cloud_done'} size={14} />
      <Text style={{ flex: 1 }} tone={offline ? 'warning' : 'muted'} variant="label">
        {offline ? t('common.offline') : ''}
        {offline && savedAt ? ' ' : ''}
        {savedAt ? t('common.updatedAt', { time: time(savedAt) }) : ''}
      </Text>
    </Animated.View>
  );
}
