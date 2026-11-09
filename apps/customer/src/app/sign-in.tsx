import { Banner, Button, PressableScale, space, Surface, Text, useAppTheme } from '@citius/ui';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconPair, TextField } from '@/components/kit';
import { EASE_OUT } from '@/components/motion';
import { SignInHero } from '@/components/sign-in-hero';
import { SHEET_OVERLAP } from '@/features/auth/sign-in-artwork';
import { isEmail, requestEmailLink, type RequestResult, SIGN_IN_METHODS, type SignInMethodId, verifyEmailLink } from '@/features/auth/methods';
import { initialSignIn, type SendProblem, signInBody, signInReducer } from '@/features/auth/sign-in-flow';
import { afterSignIn, currentReturnTo } from '@/features/session/after-sign-in';
import { PENDING_INVITE_KEY, RETURN_TO_KEY, SERVER_STALL_MS, useCustomerSession } from '@/features/session/session';
import { useI18n } from '@/i18n/i18n';
import { useStoredValue } from '@/lib/app-store';
import { haptic } from '@/lib/haptic';
import { logEvent } from '@/lib/safe-log';
import { useAnnounce } from '@/lib/use-announce';
import { useRevealEndOnKeyboard } from '@/lib/use-reveal-end-on-keyboard';
import { useNow } from '@/lib/use-now';

const RESEND_AFTER_MS = 30_000;

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
  icon: IconPair;
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

/** Opening the link. If the session has not come through after a while, says so and offers a way back. */
function VerifyingLink({ onStartAgain }: { onStartAgain: () => void }) {
  const theme = useAppTheme();
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SERVER_STALL_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
      <ActivityIndicator color={theme.color.primary} />
      <Text>{t('signIn.verifying')}</Text>
      {slow ? (
        <Animated.View entering={stateEntering} style={{ alignItems: 'center', alignSelf: 'stretch', gap: space.md }}>
          <Text style={{ textAlign: 'center' }} tone="muted" variant="secondary">
            {t('signIn.slow')}
          </Text>
          <Button label={t('signIn.startAgain')} onPress={onStartAgain} variant="secondary" />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A link that did not work: a dropped connection can be retried, a refused link cannot. */
function LinkFailed({ onNewLink, onRetry, reason }: { onNewLink: () => void; onRetry: () => void; reason: 'network' | 'refused' }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: space.lg }}>
      <Banner tone="danger">
        <Text variant="secondary">{t(reason === 'network' ? 'signIn.network' : 'signIn.linkFailed')}</Text>
      </Banner>
      {reason === 'network' ? <Button label={t('common.retry')} onPress={onRetry} /> : null}
      <Button label={t('signIn.newLink')} onPress={onNewLink} variant={reason === 'network' ? 'secondary' : 'primary'} />
    </View>
  );
}

/** Why the last request for a link did not go out. */
function SendProblemBanner({ problem }: { problem: SendProblem | null }) {
  const { t } = useI18n();
  if (!problem) return null;
  return (
    <Banner tone="danger">
      <Text accessibilityLiveRegion="polite" variant="secondary">
        {t(problem)}
      </Text>
    </Banner>
  );
}

function LinkSent({
  busy,
  onResend,
  onUseOther,
  problem,
  sentTo,
  waitMs,
}: {
  busy: boolean;
  onResend: () => void;
  onUseOther: () => void;
  problem: SendProblem | null;
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
      <SendProblemBanner problem={problem} />
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
  problem: SendProblem | null;
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
      <SendProblemBanner problem={problem} />
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
  const [storedReturnTo] = useStoredValue<unknown>(RETURN_TO_KEY, null);
  const [method, setMethod] = useState<SignInMethodId>('email');
  const [email, setEmail] = useState('');
  // The link being opened and the request for one, as one state (sign-in-flow.ts).
  const [state, dispatch] = useReducer(signInReducer, Boolean(token), initialSignIn);
  const { link, send: request } = state;
  const now = useNow(1_000);
  const verifiedToken = useRef<string | null>(null);
  /** The link arrived while the traveller was already in the app, on top of another screen. */
  const openedSignedIn = useRef(false);
  const { props: reveal } = useRevealEndOnKeyboard();
  useAnnounce(request.problem ? t(request.problem) : null);

  const signedIn = gate.kind === 'signedIn';
  const returnTo = currentReturnTo(storedReturnTo, now);

  const open = useCallback((value: string, alreadySignedIn: boolean) => {
    openedSignedIn.current = alreadySignedIn;
    dispatch({ link: { kind: 'opening' }, type: 'link' });
    void verifyEmailLink(value, { signedIn: alreadySignedIn }).then((result) => {
      if (result.ok) return dispatch({ link: { kind: 'opened' }, type: 'link' });
      logEvent(result.reason === 'network' ? 'auth.link-unreachable' : 'auth.link-refused');
      dispatch({ link: { kind: 'failed', reason: result.reason === 'network' ? 'network' : 'refused' }, type: 'link' });
    });
  }, []);

  useEffect(() => {
    if (!token || verifiedToken.current === token) return;
    verifiedToken.current = token;
    open(token, signedIn);
  }, [open, signedIn, token]);

  // Once the session is live, go where the traveller was heading (after-sign-in.ts).
  useEffect(() => {
    const next = afterSignIn({ canGoBack: openedSignedIn.current && router.canGoBack(), link, pendingInvite, returnTo, signedIn });
    if (next.kind === 'return') router.dismissTo(next.path);
    else if (next.kind === 'invite') router.replace({ params: { token: next.token }, pathname: '/invite' });
    else if (next.kind === 'back') router.back();
    else if (next.kind === 'home' && link.kind === 'opened') router.replace('/');
  }, [link, pendingInvite, returnTo, signedIn]);

  const startAgain = () => {
    dispatch({ link: { kind: 'none' }, type: 'link' });
    router.setParams({ token: undefined });
  };

  if (signedIn && !token && !pendingInvite) {
    return <Redirect href="/" />;
  }

  const send = async () => {
    if (request.sending) return;
    // "Send it again" goes to the address the link went to; the form sends what is typed.
    const address = request.kind === 'sent' ? request.to : email;
    if (!address.trim()) return dispatch({ problem: 'signIn.emailRequired', type: 'refused-input' });
    if (!isEmail(address)) return dispatch({ problem: 'signIn.emailInvalid', type: 'refused-input' });
    dispatch({ type: 'sending' });
    // It answers failures itself; a throw is treated as a dropped connection so the screen never sticks on sending.
    const result = await requestEmailLink(address, pendingInvite).catch((): RequestResult => ({ ok: false, reason: 'network' }));
    if (result.ok) {
      haptic('success');
      dispatch({ at: Date.now(), to: address.trim().toLowerCase(), type: 'sent' });
    } else {
      haptic('error');
      dispatch({ problem: result.reason === 'rate-limited' ? 'signIn.tooMany' : 'signIn.network', type: 'send-failed' });
    }
  };

  const bodyKey = signInBody(state, signedIn);
  let body;
  if (bodyKey === 'verifying') {
    body = <VerifyingLink onStartAgain={startAgain} />;
  } else if (link.kind === 'failed') {
    body = <LinkFailed onNewLink={startAgain} onRetry={() => token && open(token, signedIn)} reason={link.reason} />;
  } else if (request.kind === 'sent') {
    body = (
      <LinkSent
        busy={request.sending}
        onResend={() => void send()}
        onUseOther={() => {
          dispatch({ type: 'use-other' });
          setEmail('');
        }}
        problem={request.problem}
        sentTo={request.to}
        waitMs={request.at + RESEND_AFTER_MS - now}
      />
    );
  } else {
    body = (
      <EmailForm
        busy={request.sending}
        email={email}
        method={method}
        onChangeEmail={(value) => {
          setEmail(value);
          dispatch({ type: 'edited' });
        }}
        onMethod={setMethod}
        onSend={() => void send()}
        problem={request.problem}
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
        {...reveal}
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
