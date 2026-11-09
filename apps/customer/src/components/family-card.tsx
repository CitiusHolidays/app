import { customerApi, type ConsentState, PARENTAL_CONSENT_TEXT_VERSION, type TripDetail } from '@citius/backend/customer';
import { Banner, Button, space, StatusPill, Surface, Text } from '@citius/ui';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { haptic } from '@/lib/haptic';
import { logEvent } from '@/lib/safe-log';

type Minor = TripDetail['minors'][number];

/**
 * A consent change for one child: on its way to the server, or refused. Each child has its own, so
 * saving one child's consent never clears another's spinner or hides another's failure.
 */
type ConsentChange = { kind: 'saving' } | { kind: 'failed' };

const CONSENT_LABEL: Record<ConsentState, MessageKey> = {
  granted: 'trip.consentGiven',
  none: 'trip.consentNone',
  withdrawn: 'trip.consentWithdrawn',
};

/** The children the traveller guards, with their own consent and a way to give or withdraw it. */
export function FamilyCard({ detail, tripId }: { detail: TripDetail; tripId: string }) {
  const { t } = useI18n();
  const setConsent = useMutation(customerApi.setParentalConsent.ref);
  const [changes, setChanges] = useState<Readonly<Partial<Record<string, ConsentChange>>>>({});
  const settle = (travellerId: string, change: ConsentChange | null) =>
    setChanges((current) => {
      const next = { ...current };
      if (change) next[travellerId] = change;
      else delete next[travellerId];
      return next;
    });
  const change = async (minor: Minor, action: 'granted' | 'withdrawn') => {
    settle(minor.travellerId, { kind: 'saving' });
    try {
      await setConsent({ action, minorTravellerId: minor.travellerId, textVersion: PARENTAL_CONSENT_TEXT_VERSION, tripId });
      haptic('success');
      settle(minor.travellerId, null);
    } catch (error) {
      logEvent('trip.consent-failed', error);
      settle(minor.travellerId, { kind: 'failed' });
    }
  };
  // Consent is recorded against the wording the traveller saw, so both directions show it first:
  // giving shows the same statement the invite asks them to tick.
  const ask = (minor: Minor) => {
    const name = minor.fullName.split(' ')[0] ?? minor.fullName;
    if (minor.consent === 'granted') {
      Alert.alert(t('trip.withdrawTitle', { name }), t('trip.withdrawBody', { name }), [
        { style: 'cancel', text: t('common.cancel') },
        { onPress: () => void change(minor, 'withdrawn'), style: 'destructive', text: t('trip.withdrawConsent') },
      ]);
    } else {
      Alert.alert(t('trip.giveTitle', { name }), t('invite.consentLabel', { name }), [
        { style: 'cancel', text: t('common.cancel') },
        { onPress: () => void change(minor, 'granted'), text: t('trip.giveConsent') },
      ]);
    }
  };
  return (
    <Surface style={{ gap: space.md }}>
      <Text accessibilityRole="header" variant="section">
        {t('trip.family')}
      </Text>
      {detail.minors.map((minor) => {
        const pending = changes[minor.travellerId];
        return (
          <View key={minor.travellerId} style={{ gap: space.sm }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}>
              <Text style={{ flex: 1 }} variant="bodyStrong">
                {minor.fullName}
              </Text>
              <StatusPill kind={minor.consent === 'granted' ? 'good' : 'attention'} label={t(CONSENT_LABEL[minor.consent])} />
            </View>
            <Button
              busy={pending?.kind === 'saving'}
              label={minor.consent === 'granted' ? t('trip.withdrawConsent') : t('trip.giveConsent')}
              onPress={() => ask(minor)}
              variant="secondary"
            />
            {pending?.kind === 'failed' ? (
              <Banner tone="danger">
                <Text accessibilityLiveRegion="polite" variant="secondary">
                  {t('trip.consentFailed')}
                </Text>
              </Banner>
            ) : null}
          </View>
        );
      })}
    </Surface>
  );
}
