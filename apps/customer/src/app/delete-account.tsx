import {
  ACCOUNT_DELETION_CONFIRMATION,
  CUSTOMER_ERRORS,
  customerApi,
  type DeletionEligibility,
} from '@citius/backend/customer';
import { Banner, Button, space, Surface, Text, useAppTheme } from '@citius/ui';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { Icon, MessageScreen, Placeholder, Screen, TextField } from '@/components/kit';
import { requestEmailLink } from '@/features/auth/methods';
import { RETURN_TO_KEY, useCustomerSession } from '@/features/session/session';
import { CITIUS_EMAIL } from '@/features/support/contacts';
import { serverCode } from '@/features/trips/errors';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { useStoredValue } from '@/lib/app-store';
import { haptic } from '@/lib/haptic';
import { logEvent } from '@/lib/safe-log';
import { runThen } from '@/lib/run-then';

type Check = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'answer'; value: DeletionEligibility };

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

/**
 * Self-service account deletion (App Store 5.1.1(v)), through the website's deletion API: the
 * same rules as the web Account settings. The server wants a recent sign-in, so the traveller
 * confirms by email link first, then types the confirmation word.
 */
export default function DeleteAccount() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const convex = useConvex();
  const { forget } = useCustomerSession();
  const profile = useQuery(customerApi.getMyProfile.ref, {});
  const deleteAccount = useMutation(customerApi.deleteMyAccount.ref);
  const [, setReturnTo] = useStoredValue<string | null>(RETURN_TO_KEY, null);
  const [check, setCheck] = useState<Check>({ kind: 'loading' });
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Re-checked whenever the screen comes back into view (after the confirmation email link).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      convex
        .query(customerApi.getMyAccountDeletionEligibility.ref, { referenceNow: Date.now() })
        .then((value) => active && setCheck({ kind: 'answer', value }))
        .catch((error: unknown) => {
          if (!active) return;
          logEvent('account.deletion-check-failed', error);
          setCheck(isMissingFunction(error) ? { kind: 'unavailable' } : { kind: 'answer', value: { status: 'reauthentication_required' } });
        });
      return () => {
        active = false;
      };
    }, [convex])
  );

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
      async () => {
        await setReturnTo('/delete-account');
        return await requestEmailLink(email);
      },
      () => setBusy(false)
    );
    if (result.ok) setLinkSent(true);
    else setProblem(result.reason === 'rate-limited' ? 'signIn.tooMany' : 'signIn.network');
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
        setCheck({ kind: 'answer', value: { status: 'reauthentication_required' } });
      } else if (code === CUSTOMER_ERRORS.deletionStaff) {
        setCheck({ kind: 'answer', value: { status: 'staff_account' } });
      } else {
        setProblem('delete.failed');
      }
    }
  };

  let action;
  if (check.kind === 'loading' || profile === undefined) {
    action = <Placeholder label={t('common.loading')} lines={2} />;
  } else if (check.kind === 'unavailable') {
    action = (
      <View style={{ gap: space.md }}>
        <Text>{t('delete.unavailable', { email: CITIUS_EMAIL })}</Text>
        <Button label={t('delete.emailUs')} onPress={() => void Linking.openURL(`mailto:${CITIUS_EMAIL}`).catch(() => undefined)} variant="secondary" />
      </View>
    );
  } else if (check.value?.status === 'staff_account') {
    action = <Text>{t('delete.staff')}</Text>;
  } else if (check.value?.status === 'ready') {
    action = (
      <View style={{ gap: space.md }}>
        <TextField
          autoCapitalize="characters"
          autoCorrect={false}
          label={t('delete.typeLabel', { word: ACCOUNT_DELETION_CONFIRMATION })}
          onChangeText={setTyped}
          value={typed}
        />
        <Button
          accessibilityLabel={t('delete.confirm')}
          busy={busy}
          disabled={typed.trim() !== ACCOUNT_DELETION_CONFIRMATION}
          icon={<Icon color={theme.color.onPrimary} ios="trash" md="delete" size={16} />}
          label={t('delete.confirm')}
          onPress={() => void confirm()}
          variant="danger"
        />
      </View>
    );
  } else {
    action = (
      <View style={{ gap: space.md }}>
        <Text accessibilityRole="header" variant="section">
          {t('delete.reauthTitle')}
        </Text>
        <Text tone="muted">{t('delete.reauthBody', { email: profile?.email ?? '' })}</Text>
        {linkSent ? (
          <Banner tone="good">
            <Text variant="secondary">{t('delete.reauthSent')}</Text>
          </Banner>
        ) : null}
        <Button busy={busy} disabled={!profile?.email} label={t('delete.reauthSend')} onPress={() => void sendLink()} variant="secondary" />
      </View>
    );
  }

  return (
    <Screen contentInsetAdjustmentBehavior="automatic" tabBar={false}>
      <Surface style={{ gap: space.md }}>
        <Text variant="bodyStrong">{t('delete.intro')}</Text>
        <Point text={t('delete.point1')} />
        <Point text={t('delete.point2')} />
        <Point text={t('delete.point3')} />
        <Text tone="muted" variant="secondary">
          {t('delete.notUndone')}
        </Text>
      </Surface>
      <Surface style={{ gap: space.md }}>{action}</Surface>
      {problem ? (
        <Banner tone="danger">
          <Text accessibilityLiveRegion="polite" variant="secondary">
            {t(problem)}
          </Text>
        </Banner>
      ) : null}
    </Screen>
  );
}
