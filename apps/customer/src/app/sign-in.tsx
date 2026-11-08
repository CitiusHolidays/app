import { Banner, Button, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, TextField } from '@/components/kit';
import { SignInHero } from '@/components/sign-in-hero';
import { SHEET_OVERLAP } from '@/features/auth/sign-in-artwork';
import { isEmail, requestEmailLink, SIGN_IN_METHODS, type SignInMethodId, verifyEmailLink } from '@/features/auth/methods';
import { PENDING_INVITE_KEY, RETURN_TO_KEY, useCustomerSession } from '@/features/session/session';
import { useI18n } from '@/i18n/i18n';
import type { MessageKey } from '@/i18n/locales/en';
import { useStoredValue } from '@/lib/app-store';
import { haptic } from '@/lib/haptic';
import { logEvent } from '@/lib/safe-log';
import { useAnnounce } from '@/lib/use-announce';
import { useNow } from '@/lib/use-now';

const RESEND_AFTER_MS = 30_000;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** The sheet's content rises in once, just after the photograph's title. */
const sheetEntering = FadeInDown.duration(380).delay(200).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 12 }] });
/** Between the form, "check your email" and a failed link: a quick crossfade, no movement. */
const stateEntering = FadeIn.duration(220).easing(EASE_OUT);
const stateExiting = FadeOut.duration(120);

/** A sign-in method as a pill: filled when chosen, outlined with "Coming soon" when not yet open. */
function MethodPill({
  hint,
  icon,
  label,
  onPress,
  selected,
  soon,
}: {
  hint: string;
  icon: { ios: string; md: string };
  label: string;
  onPress: () => void;
  selected: boolean;
  soon?: string;
}) {
  const theme = useAppTheme();
  const ink = selected ? theme.color.onPrimary : soon ? theme.color.muted : theme.color.ink;
  return (
    <PressableScale
      accessibilityHint={hint}
      accessibilityLabel={[label, soon].filter(Boolean).join(', ')}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: Boolean(soon) }}
      disabled={Boolean(soon)}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: selected ? theme.color.primary : 'transparent',
        borderColor: selected ? theme.color.primary : theme.color.controlBorder,
        borderRadius: theme.radius.chip,
        borderWidth: 1,
        flexDirection: 'row',
        gap: space.sm,
        minHeight: theme.minTarget,
        paddingHorizontal: space.lg,
      }}
    >
      <Icon color={ink} ios={icon.ios} md={icon.md} size={17} />
      <Text style={{ color: ink }} variant="bodyStrong">
        {label}
      </Text>
      {soon ? (
        <Text tone="warning" variant="label">
          {soon}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function VerifyingLink() {
  const theme = useAppTheme();
  const { t } = useI18n();
  return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
      <ActivityIndicator color={theme.color.primary} />
      <Text>{t('signIn.verifying')}</Text>
    </View>
  );
}

function LinkFailed({ onNewLink }: { onNewLink: () => void }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: space.lg }}>
      <Banner tone="danger">
        <Text variant="secondary">{t('signIn.linkFailed')}</Text>
      </Banner>
      <Button label={t('signIn.newLink')} onPress={onNewLink} />
    </View>
  );
}

function LinkSent({
  busy,
  onResend,
  onUseOther,
  sentTo,
  waitMs,
}: {
  busy: boolean;
  onResend: () => void;
  onUseOther: () => void;
  sentTo: string;
  waitMs: number;
}) {
  const theme = useAppTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Icon color={theme.color.primary} ios="envelope.open" md="mark_email_read" size={34} />
        <Text accessibilityRole="header" style={{ textAlign: 'center' }} variant="section">
          {t('signIn.sentTitle')}
        </Text>
        <Text style={{ textAlign: 'center' }} tone="muted">
          {t('signIn.sentBody', { email: sentTo })}
        </Text>
      </View>
      <Button
        disabled={waitMs > 0 || busy}
        busy={busy}
        label={waitMs > 0 ? t('signIn.resendIn', { seconds: Math.ceil(waitMs / 1000) }) : t('signIn.resend')}
        onPress={onResend}
        variant="secondary"
      />
      <Button label={t('signIn.useOther')} onPress={onUseOther} variant="secondary" />
    </View>
  );
}

function EmailForm({
  busy,
  email,
  method,
  onChangeEmail,
  onMethod,
  onSend,
  problem,
}: {
  busy: boolean;
  email: string;
  method: SignInMethodId;
  onChangeEmail: (value: string) => void;
  onMethod: (method: SignInMethodId) => void;
  onSend: () => void;
  problem: MessageKey | null;
}) {
  const { t } = useI18n();
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <Text accessibilityRole="header" variant="bodyStrong">
          {t('signIn.methodLabel')}
        </Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {SIGN_IN_METHODS.map((option) =>
            option.id === 'email' ? (
              <MethodPill
                hint={t('signIn.method.emailHint')}
                icon={{ ios: 'envelope', md: 'mail' }}
                key={option.id}
                label={t('signIn.method.email')}
                onPress={() => {
                  if (method !== 'email') haptic('selection');
                  onMethod('email');
                }}
                selected={method === 'email'}
              />
            ) : (
              <MethodPill
                hint={t('signIn.method.smsHint')}
                icon={{ ios: 'message', md: 'sms' }}
                key={option.id}
                label={t('signIn.method.sms')}
                onPress={() => onMethod('sms')}
                selected={method === 'sms'}
                soon={option.available ? undefined : t('common.comingSoon')}
              />
            )
          )}
        </View>
        <Text tone="muted" variant="label">
          {t('signIn.method.emailHint')}
        </Text>
      </View>
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        inputMode="email"
        keyboardType="email-address"
        label={t('signIn.emailLabel')}
        onChangeText={onChangeEmail}
        onSubmitEditing={onSend}
        returnKeyType="send"
        textContentType="emailAddress"
        value={email}
      />
      {problem ? (
        <Banner tone="danger">
          <Text accessibilityLiveRegion="polite" variant="secondary">
            {t(problem)}
          </Text>
        </Banner>
      ) : null}
      <Button busy={busy} label={t('signIn.send')} onPress={onSend} />
      <Text style={{ textAlign: 'center' }} tone="muted" variant="label">
        {t('signIn.help')}
      </Text>
    </View>
  );
}

/**
 * Sign-in by email link. The link opens the website's `/app/sign-in` page, which hands the token to
 * this screen as `citius://sign-in?token=…`; the app then verifies it itself. The same screen
 * handles a link that arrives while signed in (confirming it's you before deleting the account).
 */
export default function SignIn() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { gate } = useCustomerSession();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [pendingInvite] = useStoredValue<string | null>(PENDING_INVITE_KEY, null);
  const [returnTo, setReturnTo] = useStoredValue<string | null>(RETURN_TO_KEY, null);
  const [method, setMethod] = useState<SignInMethodId>('email');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [verifying, setVerifying] = useState<'idle' | 'running' | 'done' | 'failed'>(token ? 'running' : 'idle');
  const now = useNow(1_000);
  const verifiedToken = useRef<string | null>(null);
  useAnnounce(problem ? t(problem) : null);

  useEffect(() => {
    if (!token || verifiedToken.current === token) return;
    verifiedToken.current = token;
    setVerifying('running');
    void verifyEmailLink(token).then((result) => {
      if (!result.ok) logEvent('auth.link-refused');
      setVerifying(result.ok ? 'done' : 'failed');
    });
  }, [token]);

  // Once the session is live, go where the traveller was heading.
  const signedIn = gate.kind === 'signedIn';
  useEffect(() => {
    if (!signedIn || verifying === 'running' || verifying === 'failed') return;
    if (returnTo) {
      void setReturnTo(null);
      router.replace(returnTo as never);
    } else if (pendingInvite) {
      router.replace({ params: { token: pendingInvite }, pathname: '/invite' });
    } else if (verifying === 'done') {
      router.replace('/');
    }
  }, [pendingInvite, returnTo, setReturnTo, signedIn, verifying]);

  if (signedIn && !token && !returnTo && !pendingInvite) {
    return <Redirect href="/" />;
  }

  const send = async () => {
    if (busy) return;
    if (!email.trim()) return setProblem('signIn.emailRequired');
    if (!isEmail(email)) return setProblem('signIn.emailInvalid');
    setBusy(true);
    setProblem(null);
    const result = await requestEmailLink(email, pendingInvite);
    setBusy(false);
    if (result.ok) {
      haptic('success');
      setSentTo(email.trim().toLowerCase());
      setSentAt(Date.now());
    } else {
      haptic('error');
      setProblem(result.reason === 'rate-limited' ? 'signIn.tooMany' : 'signIn.network');
    }
  };

  const waitMs = sentAt + RESEND_AFTER_MS - now;
  let body;
  let bodyKey: string;
  if (verifying === 'running' || (verifying === 'done' && !signedIn)) {
    bodyKey = 'verifying';
    body = <VerifyingLink />;
  } else if (verifying === 'failed') {
    bodyKey = 'failed';
    body = (
      <LinkFailed
        onNewLink={() => {
          setVerifying('idle');
          router.setParams({ token: undefined });
        }}
      />
    );
  } else if (sentTo) {
    bodyKey = 'sent';
    body = (
      <LinkSent
        busy={busy}
        onResend={() => void send()}
        onUseOther={() => {
          setSentTo(null);
          setEmail('');
        }}
        sentTo={sentTo}
        waitMs={waitMs}
      />
    );
  } else {
    bodyKey = 'form';
    body = (
      <EmailForm
        busy={busy}
        email={email}
        method={method}
        onChangeEmail={(value) => {
          setEmail(value);
          setProblem(null);
        }}
        onMethod={setMethod}
        onSend={() => void send()}
        problem={problem}
      />
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ backgroundColor: theme.color.ground, flex: 1 }}>
      <ScrollView
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
      >
        <SignInHero intro={pendingInvite ? t('signIn.inviteWaiting') : t('signIn.intro')} />
        <Surface
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderRadius: theme.radius.hero,
            flexGrow: 1,
            marginTop: -SHEET_OVERLAP,
            padding: theme.frame,
            paddingBottom: insets.bottom + space.xxl,
            paddingTop: space.xl,
          }}
        >
          <Animated.View entering={sheetEntering}>
            <Animated.View entering={stateEntering} exiting={stateExiting} key={bodyKey}>
              {body}
            </Animated.View>
          </Animated.View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
