import { Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, TopTint } from '@/components/kit';
import { Pop, Rise } from '@/components/motion-views';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { haptic } from '@/lib/haptic';

/** How long "You're all set" stays before the trip opens by itself. */
const ADDED_HOLD_MS = 1800;

/**
 * The invite's rare, earned moment, after the owner's "You're all set" reference: a success badge
 * pops and what the traveller now has ticks in line by line (40ms apart), then the trip opens on
 * its own, or at once from the button. The haptic lands with the badge.
 */
export function AddedMoment({ destination, tripId }: { destination: string | null; tripId: string | null }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const open = () => (tripId ? router.replace({ params: { id: tripId }, pathname: '/trip/[id]' }) : router.replace('/'));
  useEffect(() => {
    haptic('success');
    const timer = setTimeout(() => {
      if (tripId) router.replace({ params: { id: tripId }, pathname: '/trip/[id]' });
      else router.replace('/');
    }, ADDED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [tripId]);
  const items: MessageKey[] = ['trip.plan', 'trip.documents', 'trip.contacts', 'trip.updates'];
  return (
    <View style={{ backgroundColor: theme.color.ground, flex: 1, justifyContent: 'center', padding: theme.frame, paddingBottom: insets.bottom + space.xxl, paddingTop: insets.top + space.xxl }}>
      <TopTint />
      <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: space.lg }}>
        <Pop
          style={{
            alignItems: 'center',
            backgroundColor: theme.color.successSoft,
            borderRadius: 36,
            height: 72,
            justifyContent: 'center',
            width: 72,
          }}
        >
          <Icon color={theme.color.success} ios="checkmark" md="check" size={34} />
        </Pop>
        <Rise index={1} style={{ alignItems: 'center', gap: space.xs }}>
          <Text accessibilityRole="header" style={{ textAlign: 'center' }} variant="display">
            {t('invite.addedTitle')}
          </Text>
          {destination ? (
            <Text style={{ textAlign: 'center' }} tone="muted">
              {t('invite.addedBody', { destination })}
            </Text>
          ) : null}
        </Rise>
        <Surface style={{ alignSelf: 'stretch', gap: space.sm }}>
          {items.map((item, index) => (
            <Rise delay={120} index={index + 2} key={item} style={{ alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 32 }}>
              <Icon color={theme.color.success} ios="checkmark.circle.fill" md="check_circle" size={18} />
              <Text>{t(item)}</Text>
            </Rise>
          ))}
        </Surface>
        <Rise delay={120} index={7} style={{ alignSelf: 'stretch' }}>
          <Button label={t('invite.addedOpen')} onPress={open} />
        </Rise>
      </View>
    </View>
  );
}
