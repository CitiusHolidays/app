import { customerApi, PARENTAL_CONSENT_TEXT_VERSION } from '@citius/backend/customer';
import { Banner, Button, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useMutation, useQuery } from 'convex/react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DestinationCover } from '@/components/destination-cover';
import { haptic, Icon, MessageScreen, TopTint } from '@/components/kit';
import { InviteSkeleton } from '@/components/skeletons';
import { PENDING_INVITE_KEY, useCustomerSession } from '@/features/session/session';
import { inviteErrorMessage } from '@/features/trips/errors';
import { parseInviteToken } from '@/features/trips/model';
import { useReferenceNow } from '@/features/trips/reference-now';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { useStoredValue } from '@/lib/app-store';
import { logEvent } from '@/lib/safe-log';

function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={{ alignItems: 'flex-start', flexDirection: 'row', gap: space.md, minHeight: theme.minTarget, paddingVertical: space.sm }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: checked ? theme.color.primary : theme.color.surface,
          borderColor: checked ? theme.color.primary : theme.color.controlBorder,
          borderRadius: 8,
          borderWidth: 2,
          height: 26,
          justifyContent: 'center',
          marginTop: 1,
          width: 26,
        }}
      >
        {checked ? <Icon color={theme.color.onPrimary} ios="checkmark" md="check" size={15} /> : null}
      </View>
      <Text style={{ flex: 1 }}>{label}</Text>
    </PressableScale>
  );
}

function Refusal({ body, title }: { body: MessageKey; title: MessageKey }) {
  const { t } = useI18n();
  const { gate } = useCustomerSession();
  return (
    <MessageScreen
      actions={
        <Button label={t('common.close')} onPress={() => router.replace(gate.kind === 'signedIn' ? '/' : '/sign-in')} variant="secondary" />
      }
      icon={{ ios: 'link.badge.plus', md: 'link_off' }}
      kicker={t('invite.kicker')}
      text={t(body)}
      title={t(title)}
    />
  );
}

/** Signed in: what the invite is for, the guardian's consent ticks, and Accept. */
function InviteForAccount({ token }: { token: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { dayRange, t } = useI18n();
  const referenceNow = useReferenceNow();
  const preview = useQuery(customerApi.previewInvite.ref, { referenceNow, token });
  const claim = useMutation(customerApi.claimInvite.ref);
  const profile = useQuery(customerApi.getMyProfile.ref, {});
  const { signOut } = useCustomerSession();
  const [, setPending] = useStoredValue<string | null>(PENDING_INVITE_KEY, null);
  const [consents, setConsents] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);

  useEffect(() => {
    // The invite is in hand now; a later sign-in should not reopen it.
    void setPending(null);
  }, [setPending]);

  if (preview === undefined) {
    return (
      <View style={{ backgroundColor: theme.color.ground, flex: 1, padding: theme.frame, paddingTop: insets.top + space.xxl }}>
        <InviteSkeleton label={t('common.loading')} />
      </View>
    );
  }
  if (preview.status === 'claimed_by_you') {
    return <Redirect href={{ params: { id: preview.tripId }, pathname: '/trip/[id]' }} />;
  }
  if (preview.status !== 'valid') {
    if (preview.status === 'expired') return <Refusal body="invite.expiredBody" title="invite.expiredTitle" />;
    if (preview.status === 'used') return <Refusal body="invite.usedBody" title="invite.usedTitle" />;
    return <Refusal body="invite.invalidBody" title="invite.invalidTitle" />;
  }

  const accept = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const minorTravellerIds = preview.minors.map((minor) => minor.travellerId).filter((id) => consents.has(id));
      const result = await claim({
        ...(minorTravellerIds.length ? { consent: { minorTravellerIds, textVersion: PARENTAL_CONSENT_TEXT_VERSION } } : {}),
        token,
      });
      haptic('success');
      if (preview.trip) {
        router.replace({ params: { id: result.tripId }, pathname: '/trip/[id]' });
      } else {
        router.replace('/');
      }
    } catch (error) {
      logEvent('invite.claim-failed', error);
      haptic('error');
      setProblem(inviteErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <View style={{ backgroundColor: theme.color.ground, flex: 1 }}>
      <TopTint />
      <ScrollView
        contentContainerStyle={{ gap: space.xl, padding: theme.frame, paddingBottom: insets.bottom + space.xxl, paddingTop: insets.top + space.xxl }}
      >
        <View accessible accessibilityRole="header" style={{ gap: space.sm }}>
          <Text tone="muted" variant="mono">
            {t('invite.kicker')}
          </Text>
          <Text variant="display">{t('invite.greeting', { name: preview.firstName })}</Text>
        </View>
        <View style={{ backgroundColor: theme.color.dark, borderRadius: theme.radius.hero, height: 300, overflow: 'hidden' }}>
          <DestinationCover photo={preview.trip?.cover ?? null} priority="high" />
          <View style={{ flex: 1, gap: space.sm, justifyContent: 'flex-end', padding: space.xl }}>
            {preview.trip ? (
              <>
                <Text style={{ fontSize: 42, lineHeight: 46 }} tone="onDark" variant="display">
                  {preview.trip.destination}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {dayRange(preview.trip.travelStartDate, preview.trip.travelEndDate) ?? ''}
                </Text>
              </>
            ) : (
              <Text tone="onDark">{t('invite.tripHidden')}</Text>
            )}
          </View>
        </View>
        <Text>{t('invite.body')}</Text>
        {preview.minors.length > 0 ? (
          <Surface style={{ gap: space.sm }}>
            <Text accessibilityRole="header" variant="section">
              {t('invite.minorsTitle')}
            </Text>
            <Text tone="muted" variant="secondary">
              {t('invite.minorsBody')}
            </Text>
            {preview.minors.map((minor) => (
              <Checkbox
                checked={consents.has(minor.travellerId)}
                key={minor.travellerId}
                label={t('invite.consentLabel', { name: minor.firstName })}
                onToggle={() =>
                  setConsents((current) => {
                    const next = new Set(current);
                    if (next.has(minor.travellerId)) next.delete(minor.travellerId);
                    else next.add(minor.travellerId);
                    return next;
                  })
                }
              />
            ))}
            <Text tone="muted" variant="label">
              {t('invite.consentNote')}
            </Text>
          </Surface>
        ) : null}
        {problem ? (
          <Banner tone="danger">
            <Text accessibilityLiveRegion="polite" variant="secondary">
              {t(problem)}
            </Text>
          </Banner>
        ) : null}
        {/* Which account the trip goes to, before the traveller commits (a link forwarded by
            someone else must not attach their trip to the wrong account). */}
        {profile?.email ? (
          <Text accessibilityLiveRegion="polite" tone="muted">
            {t('invite.acceptingAs', { email: profile.email })}
          </Text>
        ) : null}
        <Button busy={busy} disabled={!profile?.email} label={t('invite.accept')} onPress={() => void accept()} />
        <Button
          label={t('invite.notYou')}
          onPress={() => {
            // Keep the link so the right person can accept it after signing in.
            void setPending(token).then(signOut);
          }}
          variant="secondary"
        />
      </ScrollView>
    </View>
  );
}

/**
 * Where an invite link lands (`citius://invite?token=…`). Signed out, the token is kept on the
 * phone and the traveller signs in first; signed in, they see what the invite is for and accept it.
 */
export default function Invite() {
  const { t } = useI18n();
  const { gate } = useCustomerSession();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token ? parseInviteToken(params.token) : null;
  const [, setPending] = useStoredValue<string | null>(PENDING_INVITE_KEY, null);
  if (!token) {
    return <Refusal body="invite.invalidBody" title="invite.invalidTitle" />;
  }
  if (gate.kind === 'signedIn') {
    return <InviteForAccount token={token} />;
  }
  return (
    <MessageScreen
      actions={
        <Button
          label={t('invite.signIn')}
          onPress={() => {
            void setPending(token).then(() => router.replace('/sign-in'));
          }}
        />
      }
      icon={{ ios: 'airplane', md: 'flight' }}
      kicker={t('invite.kicker')}
      text={t('invite.signedOutBody')}
      title={t('invite.signedOutTitle')}
    />
  );
}
