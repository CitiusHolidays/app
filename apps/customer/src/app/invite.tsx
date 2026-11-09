import { customerApi, PARENTAL_CONSENT_TEXT_VERSION } from '@citius/backend/customer';
import { Banner, Button, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useMutation, useQuery } from 'convex/react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DestinationCover } from '@/components/destination-cover';
import { DESTINATION_TYPE } from '@/components/destination-type';
import { AddedMoment } from '@/components/invite-added';
import { MOTION } from '@/components/motion';
import { Icon, MessageScreen, QuietState, TopTint } from '@/components/kit';
import { RoundBackButton } from '@/components/round-button';
import { InviteSkeleton } from '@/components/skeletons';
import { PENDING_INVITE_KEY, useCustomerSession } from '@/features/session/session';
import { inviteErrorMessage } from '@/features/trips/errors';
import { added, type AcceptState, inviteView, READY, type ValidInvite } from '@/features/trips/invite-flow';
import { parseInviteToken } from '@/features/trips/model';
import { useReferenceNow } from '@/features/trips/reference-now';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { useStoredValue } from '@/lib/app-store';
import { haptic } from '@/lib/haptic';
import { logEvent } from '@/lib/safe-log';

export { ScreenError as ErrorBoundary } from '@/components/error-boundary';

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
      {/* The box fills (150ms) with the tick in it; unticking just clears (transitions.dev check). */}
      <Animated.View
        style={{
          alignItems: 'center',
          backgroundColor: checked ? theme.color.primary : theme.color.surface,
          borderColor: checked ? theme.color.primary : theme.color.controlBorder,
          borderRadius: 8,
          borderWidth: 2,
          height: 26,
          justifyContent: 'center',
          marginTop: 1,
          transitionDuration: MOTION.quick,
          transitionProperty: ['backgroundColor', 'borderColor'],
          width: 26,
        }}
      >
        {checked ? <Icon color={theme.color.onPrimary} ios="checkmark" md="check" size={15} /> : null}
      </Animated.View>
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

const REFUSAL: Record<'expired' | 'used' | 'invalid', { body: MessageKey; title: MessageKey }> = {
  expired: { body: 'invite.expiredBody', title: 'invite.expiredTitle' },
  invalid: { body: 'invite.invalidBody', title: 'invite.invalidTitle' },
  used: { body: 'invite.usedBody', title: 'invite.usedTitle' },
};

/** Where the page starts: under the round Close button (8pt down, 48pt tall) with room to breathe. */
const BELOW_CLOSE = space.sm + 48 + space.lg;

/** Leaves the invite for later from any state: back, or Journeys after a cold start from the link. */
function CloseCorner() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ left: theme.frame, position: 'absolute', top: insets.top + space.sm, zIndex: 1 }}>
      <RoundBackButton close onPaper />
    </View>
  );
}

/** The trip's cover photo with its destination and dates, or a note that the trip opens later. */
function InviteCover({ trip }: { trip: ValidInvite['trip'] }) {
  const theme = useAppTheme();
  const { dayRange, t } = useI18n();
  return (
    <View style={{ backgroundColor: theme.color.dark, borderRadius: theme.radius.hero, height: 300, overflow: 'hidden' }}>
      <DestinationCover photo={trip?.cover ?? null} priority="high" />
      <View style={{ flex: 1, gap: space.sm, justifyContent: 'flex-end', padding: space.xl }}>
        {trip ? (
          <>
            <Text style={DESTINATION_TYPE.invite} tone="onDark" variant="display">
              {trip.destination}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{dayRange(trip.travelStartDate, trip.travelEndDate) ?? ''}</Text>
          </>
        ) : (
          <Text tone="onDark">{t('invite.tripHidden')}</Text>
        )}
      </View>
    </View>
  );
}

/** One consent tick per child the guardian is accepting for. */
function GuardianConsent({
  consents,
  minors,
  onToggle,
}: {
  consents: ReadonlySet<string>;
  minors: ValidInvite['minors'];
  onToggle: (travellerId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Surface style={{ gap: space.sm }}>
      <Text accessibilityRole="header" variant="section">
        {t('invite.minorsTitle')}
      </Text>
      <Text tone="muted" variant="secondary">
        {t('invite.minorsBody')}
      </Text>
      {minors.map((minor) => (
        <Checkbox
          checked={consents.has(minor.travellerId)}
          key={minor.travellerId}
          label={t('invite.consentLabel', { name: minor.firstName })}
          onToggle={() => {
            haptic('selection');
            onToggle(minor.travellerId);
          }}
        />
      ))}
      <Text tone="muted" variant="label">
        {t('invite.consentNote')}
      </Text>
    </Surface>
  );
}

/**
 * Which account the trip goes to, before the traveller commits (a link forwarded by someone else
 * must not attach their trip to the wrong account). `email` is undefined while the profile loads.
 */
function AcceptingAs({ email, offline }: { email: string | null | undefined; offline: boolean }) {
  const { t } = useI18n();
  let text = t('invite.noEmail');
  if (email) text = t('invite.acceptingAs', { email });
  else if (email === undefined) text = t(offline ? 'invite.offline' : 'common.loading');
  return (
    <Text accessibilityLiveRegion="polite" tone="muted">
      {text}
    </Text>
  );
}

/** Signed in: what the invite is for, the guardian's consent ticks, and Accept. */
function InviteForAccount({ token }: { token: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const referenceNow = useReferenceNow();
  const preview = useQuery(customerApi.previewInvite.ref, { referenceNow, token });
  const claim = useMutation(customerApi.claimInvite.ref);
  const profile = useQuery(customerApi.getMyProfile.ref, {});
  const { offline, signOut } = useCustomerSession();
  const [, setPending] = useStoredValue<string | null>(PENDING_INVITE_KEY, null);
  const [consents, setConsents] = useState<Set<string>>(() => new Set());
  const [accept, setAccept] = useState<AcceptState>(READY);

  useEffect(() => {
    // The invite is in hand now; a later sign-in should not reopen it.
    void setPending(null);
  }, [setPending]);

  const view = inviteView(preview, accept);
  if (view.kind === 'added') {
    return <AddedMoment destination={view.destination} tripId={view.tripId} />;
  }
  if (view.kind === 'loading') {
    return (
      <View style={{ backgroundColor: theme.color.ground, flex: 1, padding: theme.frame, paddingTop: insets.top + BELOW_CLOSE }}>
        <TopTint />
        {offline ? <QuietState text={t('invite.offline')} /> : <InviteSkeleton label={t('common.loading')} />}
        <CloseCorner />
      </View>
    );
  }
  if (view.kind === 'yours') {
    return <Redirect href={{ params: { id: view.tripId }, pathname: '/trip/[id]' }} />;
  }
  if (view.kind === 'refused') {
    const { body, title } = REFUSAL[view.reason];
    return <Refusal body={body} title={title} />;
  }
  const { invite, problem } = view;

  const acceptInvite = async () => {
    setAccept({ invite, kind: 'accepting' });
    const minorTravellerIds = invite.minors.map((minor) => minor.travellerId).filter((id) => consents.has(id));
    try {
      const result = await claim({
        ...(minorTravellerIds.length ? { consent: { minorTravellerIds, textVersion: PARENTAL_CONSENT_TEXT_VERSION } } : {}),
        token,
      });
      // The success haptic fires with the badge's first frame (AddedMoment).
      setAccept(added(invite, result.tripId));
    } catch (error) {
      logEvent('invite.claim-failed', error);
      haptic('error');
      setAccept({ kind: 'ready', problem: inviteErrorMessage(error) });
    }
  };

  return (
    <View style={{ backgroundColor: theme.color.ground, flex: 1 }}>
      <TopTint />
      <ScrollView
        contentContainerStyle={{ gap: space.xl, padding: theme.frame, paddingBottom: insets.bottom + space.xxl, paddingTop: insets.top + BELOW_CLOSE }}
      >
        <View accessible accessibilityRole="header" style={{ gap: space.sm }}>
          <Text tone="muted" variant="mono">
            {t('invite.kicker')}
          </Text>
          <Text variant="display">{t('invite.greeting', { name: invite.firstName })}</Text>
        </View>
        <InviteCover trip={invite.trip} />
        <Text>{t('invite.body')}</Text>
        {invite.minors.length > 0 ? (
          <GuardianConsent
            consents={consents}
            minors={invite.minors}
            onToggle={(travellerId) =>
              setConsents((current) => {
                const next = new Set(current);
                if (next.has(travellerId)) next.delete(travellerId);
                else next.add(travellerId);
                return next;
              })
            }
          />
        ) : null}
        {problem ? (
          <Banner tone="danger">
            <Text accessibilityLiveRegion="polite" variant="secondary">
              {t(problem)}
            </Text>
          </Banner>
        ) : null}
        <AcceptingAs email={profile === undefined ? undefined : (profile?.email ?? null)} offline={offline} />
        <Button busy={view.accepting} disabled={!profile?.email} label={t('invite.accept')} onPress={() => void acceptInvite()} />
        <Button
          label={t('invite.notYou')}
          onPress={() => {
            // Keep the link so the right person can accept it after signing in.
            void setPending(token).then(signOut);
          }}
          variant="secondary"
        />
      </ScrollView>
      <CloseCorner />
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
