import {
  ACCOUNT_DELETION_CONFIRMATION,
  CUSTOMER_ERRORS,
  customerApi,
} from '@citius/backend/customer';
import { Banner, Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon, MessageScreen, Screen, TextField } from '@/components/kit';
import { DeletionStepSkeleton } from '@/components/skeletons';
import { STEP_IN, TEXT_SWAP_IN } from '@/components/motion';
import { deletionStep, type DeletionCheck, type DeletionStep } from '@/features/account/deletion-step';
import { requestEmailLink } from '@/features/auth/methods';
import { returnToFor } from '@/features/session/after-sign-in';
import { RETURN_TO_KEY, useCustomerSession } from '@/features/session/session';
import { CITIUS_EMAIL } from '@/features/support/contacts';
import { serverCode } from '@/features/trips/errors';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { useStoredValue } from '@/lib/app-store';
import { haptic } from '@/lib/haptic';
import { openUrl } from '@/lib/open-url';
import { logEvent } from '@/lib/safe-log';
import { runThen } from '@/lib/run-then';

export { ScreenError as ErrorBoundary } from '@/components/error-boundary';

/** The website's deletion API may not be deployed yet; a missing function means "not available". */
function isMissingFunction(error: unknown) {
  return error instanceof Error && /Could not find public function/i.test(error.message);
}

function Point({ text }: { text: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <View style={{ backgroundColor: theme.color.muted, borderRadius: 3, height: 6, marginTop: 9, width: 6 }} />
      <Text style={{ flex: 1 }}>{text}</Text>
    </View>
  );
}

type StepProps = {
  busy: boolean;
  email: string;
  linkSent: boolean;
  onConfirm: () => void;
  onRetry: () => void;
  onSendLink: () => void;
  onType: (value: string) => void;
  step: DeletionStep;
  typed: string;
};

function StepBody({ step, ...props }: StepProps) {
  const { t } = useI18n();
  switch (step) {
    case 'offline':
      return <Text tone="muted">{t('delete.offline')}</Text>;
    case 'loading':
      return <DeletionStepSkeleton label={t('common.loading')} />;
    case 'error':
      return (
        <View style={{ gap: space.md }}>
          <Text>{t('signIn.network')}</Text>
          <Button label={t('common.retry')} onPress={props.onRetry} variant="secondary" />
        </View>
      );
    case 'unavailable':
      return (
        <View style={{ gap: space.md }}>
          <Text>{t('delete.unavailable', { email: CITIUS_EMAIL })}</Text>
          <Button label={t('delete.emailUs')} onPress={() => openUrl(`mailto:${CITIUS_EMAIL}`)} variant="secondary" />
        </View>
      );
    case 'staff':
      return <Text>{t('delete.staff')}</Text>;
    case 'ready':
      return <TypeToConfirm busy={props.busy} onConfirm={props.onConfirm} onType={props.onType} typed={props.typed} />;
    case 'reauth':
      return <ConfirmItsYou busy={props.busy} email={props.email} linkSent={props.linkSent} onSendLink={props.onSendLink} />;
  }
}

function TypeToConfirm({ busy, onConfirm, onType, typed }: Pick<StepProps, 'busy' | 'onConfirm' | 'onType' | 'typed'>) {
  const theme = useAppTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: space.md }}>
      <TextField
        autoCapitalize="characters"
        autoCorrect={false}
        label={t('delete.typeLabel', { word: ACCOUNT_DELETION_CONFIRMATION })}
        onChangeText={onType}
        value={typed}
      />
      <Button
        accessibilityLabel={t('delete.confirm')}
        busy={busy}
        disabled={typed.trim() !== ACCOUNT_DELETION_CONFIRMATION}
        icon={<Icon color={theme.color.onPrimary} ios="trash" md="delete" size={16} />}
        label={t('delete.confirm')}
        onPress={onConfirm}
        variant="danger"
      />
    </View>
  );
}

function ConfirmItsYou({ busy, email, linkSent, onSendLink }: Pick<StepProps, 'busy' | 'email' | 'linkSent' | 'onSendLink'>) {
  const { t } = useI18n();
  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" variant="section">
        {t('delete.reauthTitle')}
      </Text>
      <Text tone="muted">{t('delete.reauthBody', { email })}</Text>
      {linkSent ? (
        <Animated.View entering={TEXT_SWAP_IN}>
          <Banner tone="good">
            <Text variant="secondary">{t('delete.reauthSent', { email })}</Text>
          </Banner>
        </Animated.View>
      ) : null}
      <Button busy={busy} disabled={!email} label={t('delete.reauthSend')} onPress={onSendLink} variant="secondary" />
    </View>
  );
}

/**
 * Self-service account deletion (App Store 5.1.1(v)), through the website's deletion API: the
 * same rules as the web Account settings. The server wants a recent sign-in, so the traveller
 * confirms by email link first, then types the confirmation word.
 */
export default function DeleteAccount() {
  const { t } = useI18n();
  const convex = useConvex();
  const { forget, offline } = useCustomerSession();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(customerApi.getMyProfile.ref, {});
  const deleteAccount = useMutation(customerApi.deleteMyAccount.ref);
  const [, setReturnTo] = useStoredValue<unknown>(RETURN_TO_KEY, null);
  const [check, setCheck] = useState<DeletionCheck>({ kind: 'loading' });
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Re-checked whenever the screen comes back into view, on Try again, and when Convex takes up a
  // new session: the confirmation link brings the traveller back here before Convex has swapped
  // to the new session's token, and a check on the old token would still say "confirm it's you".
  // Any answer means the traveller is back here, so a waiting return note is done.
  const runCheck = useCallback(() => {
    if (!isAuthenticated) return;
    let active = true;
    convex
      .query(customerApi.getMyAccountDeletionEligibility.ref, { referenceNow: Date.now() })
      .then((value) => {
        if (!active) return;
        setCheck({ kind: 'answer', value });
        void setReturnTo(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        logEvent('account.deletion-check-failed', error);
        setCheck(isMissingFunction(error) ? { kind: 'unavailable' } : { kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, [convex, isAuthenticated, setReturnTo]);
  useFocusEffect(runCheck);

  // Android's back button on the last screen does what Close does: the account is gone.
  useEffect(() => {
    if (!done) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void forget();
      return true;
    });
    return () => subscription.remove();
  }, [done, forget]);

  if (done) {
    return (
      <>
        {/* The account is gone: no way back into its screens. */}
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <MessageScreen
          actions={<Button label={t('common.close')} onPress={() => void forget()} />}
          icon={{ ios: 'checkmark.circle', md: 'check_circle' }}
          text={t('delete.doneBody', { reference: done })}
          title={t('delete.doneTitle')}
        />
      </>
    );
  }

  const sendLink = async () => {
    if (!profile?.email) return;
    const email = profile.email;
    setBusy(true);
    setProblem(null);
    const result = await runThen(
      () => requestEmailLink(email),
      () => setBusy(false)
    );
    if (result.ok) {
      // Only a link that went out can bring the traveller back here.
      await setReturnTo(returnToFor('/delete-account', Date.now()));
      setLinkSent(true);
    } else {
      setProblem(result.reason === 'rate-limited' ? 'signIn.tooMany' : 'signIn.network');
    }
  };

  const confirm = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await runThen(() => deleteAccount({ confirmation: typed.trim() }), () => setBusy(false));
      haptic('success');
      setDone(result.reference);
    } catch (error) {
      logEvent('account.deletion-failed', error);
      haptic('error');
      const code = serverCode(error);
      if (code === CUSTOMER_ERRORS.deletionReauth) {
        setLinkSent(false);
        setCheck({ kind: 'answer', value: { status: 'reauthentication_required' } });
      } else if (code === CUSTOMER_ERRORS.deletionStaff) {
        setCheck({ kind: 'answer', value: { status: 'staff_account' } });
      } else {
        setProblem('delete.failed');
      }
    }
  };

  const step = deletionStep(check, { offline, profileLoaded: profile !== undefined });
  const email = profile?.email ?? '';
  const retry = () => {
    setCheck({ kind: 'loading' });
    runCheck();
  };

  return (
    <Screen contentInsetAdjustmentBehavior="automatic" form tabBar={false}>
      <Surface style={{ gap: space.md }}>
        <Text variant="bodyStrong">{t('delete.intro')}</Text>
        <Point text={t('delete.point1')} />
        <Point text={t('delete.point2')} />
        <Point text={t('delete.point3')} />
        <Text tone="muted" variant="secondary">
          {t('delete.notUndone')}
        </Text>
      </Surface>
      {/* Each step (confirm it's you, then type the word) takes the last one's place from 8pt
          to the right, so the flow reads as moving forward. */}
      <Surface style={{ gap: space.md }}>
        <Animated.View entering={step === 'loading' ? undefined : STEP_IN} key={step}>
          <StepBody
            busy={busy}
            email={email}
            linkSent={linkSent}
            onConfirm={() => void confirm()}
            onRetry={retry}
            onSendLink={() => void sendLink()}
            onType={setTyped}
            step={step}
            typed={typed}
          />
        </Animated.View>
      </Surface>
      {problem ? (
        <Animated.View entering={TEXT_SWAP_IN}>
          <Banner tone="danger">
            <Text accessibilityLiveRegion="polite" variant="secondary">
              {t(problem)}
            </Text>
          </Banner>
        </Animated.View>
      ) : null}
    </Screen>
  );
}
