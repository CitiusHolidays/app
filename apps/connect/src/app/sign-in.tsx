import { Banner, PressableScale, space, Text, useAppTheme } from '@citius/ui';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, TextField } from '@/components/kit';
import { OPEN_TIMEOUT_MS, type SignInState, signInRefusal } from '@/features/gate/sign-in-state';
import { clients } from '@/lib/clients';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';
import { logEvent } from '@/lib/safe-log';
import { useAnnounce } from '@/lib/use-announce';

/** The website's sign-in artwork (Udaipur), bundled so the screen opens complete with no network. */
const artwork = require('@/assets/images/sign-in-udaipur.webp');
const mark = require('@/assets/images/icon.png');

const NIGHT = '#0c1124';

/**
 * One entrance as the screen opens, never again: the photo settles from slightly close, then the
 * mark and the form rise 28pt into place. The form lands by about 420ms, so the first tap is never
 * kept waiting. Layout animations follow the phone's reduced-motion setting, which shows
 * everything in place without moving.
 */
const PHOTO_SETTLE = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.06 }] },
  100: { easing: EASE_OUT, opacity: 1, transform: [{ scale: 1 }] },
}).duration(1400);
const rise = (delay: number) => FadeInUp.duration(300).delay(delay).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 28 }] });
const MARK_IN = rise(60);
const SHEET_IN = rise(120);
const PROBLEM_IN = FadeIn.duration(200);
/**
 * Room kept under the focused field. Typing the email, the password field and the Sign in button
 * stay in view below it; typing the password, the button does.
 */
const SIGN_IN_CLEARANCE = 200;

/** Staff sign in with their existing email and password. There is no sign-up in this app. */
export default function SignIn() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [state, setState] = useState<SignInState>({ kind: 'idle' });
  const busy = state.kind === 'submitting' || state.kind === 'done';
  const problem = state.kind === 'refused' || state.kind === 'error' ? state.message : null;
  useAnnounce(problem);
  useEffect(() => {
    if (state.kind !== 'done') return;
    const timer = setTimeout(
      () => setState({ kind: 'error', message: 'Signed in, but Citius did not open. Try again.' }),
      OPEN_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [state.kind]);
  const reduced = useReducedMotion();
  // A refused sign-in shakes the fields (8, 6, 4 px over 320 ms) on the same frame as the error
  // buzz, the way a password field says no. Reduced motion: no shake; the message still fades in.
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.get() }] }));
  const refuse = () => {
    haptic('error');
    if (reduced) return;
    const leg = (to: number) => withTiming(to, { duration: 40, easing: Easing.linear });
    shakeX.set(withSequence(leg(-8), leg(8), leg(-6), leg(6), leg(-4), leg(4), withTiming(0, { duration: 80, easing: EASE_OUT })));
  };

  const submit = async () => {
    if (!clients || busy) return;
    if (!email.trim() || !password) {
      setState({ kind: 'refused', message: 'Enter your work email and password.' });
      refuse();
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const { error } = await clients.auth.signIn.email({ email: email.trim(), password });
      if (error) {
        logEvent('auth.sign-in-refused');
        const next = signInRefusal(error.status);
        // Only the person's own mistake shakes the fields; anything else just buzzes.
        if (next.kind === 'refused') refuse();
        else haptic('error');
        setState(next);
      } else {
        haptic('success');
        setState({ kind: 'done' });
      }
    } catch (error) {
      logEvent('auth.sign-in-failed', error);
      haptic('error');
      setState({ kind: 'error', message: 'Could not reach Citius. Check your connection and try again.' });
    }
  };

  const photoHeight = Math.round(height * 0.56);
  return (
    <View style={{ backgroundColor: NIGHT, flex: 1 }}>
      {/* White status bar over the photo. Mounting pushes it and leaving pops it, so the app's dark
          bar comes back on the next screen. */}
      <StatusBar style="light" />
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        entering={PHOTO_SETTLE}
        style={{ height: photoHeight, left: 0, position: 'absolute', right: 0, top: 0 }}
      >
        <Image contentFit="cover" source={artwork} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(12,17,36,0.45)', 'rgba(12,17,36,0)', 'rgba(12,17,36,0.55)', NIGHT]}
          locations={[0, 0.3, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Follows the keyboard on both platforms: the focused field lifts clear with the Sign in
          button still in view under it (Android had no keyboard handling here before). */}
      <KeyboardAwareScrollView
        bottomOffset={SIGN_IN_CLEARANCE}
        bounces={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ minHeight: photoHeight - 64, justifyContent: 'flex-end', paddingBottom: space.xl, paddingHorizontal: theme.frame + space.xs, paddingTop: insets.top + space.xl }}>
          <Animated.View accessibilityRole="header" accessible entering={MARK_IN} style={{ gap: space.md }}>
            <Image accessibilityIgnoresInvertColors source={mark} style={{ borderRadius: 14, height: 56, width: 56 }} />
            <View style={{ gap: space.xs }}>
              <Text style={{ color: '#ffffff', fontSize: 40, lineHeight: 44 }} variant="display">
                Citius Connect
              </Text>
              <Text style={{ color: theme.color.onDarkMuted }} variant="secondary">
                For Citius Holidays tour managers, on the road with a group.
              </Text>
            </View>
          </Animated.View>
        </View>
        <Animated.View
          entering={SHEET_IN}
          style={{
            backgroundColor: theme.color.ground,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            gap: space.lg,
            paddingBottom: insets.bottom + space.xl,
            paddingHorizontal: theme.frame + space.xs,
            paddingTop: space.xl,
          }}
        >
          <View style={{ gap: space.xs }}>
            <Text variant="display">Welcome back</Text>
            <Text tone="muted" variant="secondary">
              Sign in with your Citius staff account.
            </Text>
          </View>
          <Animated.View style={[{ gap: space.md }, shakeStyle]}>
            <TextField
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              icon={{ ios: 'envelope', md: 'mail' }}
              inputMode="email"
              keyboardType="email-address"
              label="Work email"
              onChangeText={setEmail}
              placeholder="name@citiusholidays.com"
              onSubmitEditing={() => passwordRef.current?.focus()}
              returnKeyType="next"
              submitBehavior="submit"
              textContentType="username"
              value={email}
            />
            <TextField
              autoCapitalize="none"
              autoComplete="current-password"
              icon={{ ios: 'lock', md: 'lock' }}
              label="Password"
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              ref={passwordRef}
              returnKeyType="go"
              secureTextEntry={!reveal}
              textContentType="password"
              trailing={
                <PressableScale
                  accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setReveal((value) => !value)}
                  style={{ alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }}
                >
                  <Icon color={theme.color.muted} ios={reveal ? 'eye.slash' : 'eye'} md={reveal ? 'visibility_off' : 'visibility'} size={19} />
                </PressableScale>
              }
              value={password}
            />
          </Animated.View>
          {problem ? (
            <Animated.View entering={PROBLEM_IN}>
              <Banner tone="danger">
                <Text accessibilityLiveRegion="polite" variant="secondary">
                  {problem}
                </Text>
              </Banner>
            </Animated.View>
          ) : null}
          <PressableScale
            accessibilityLabel="Sign in"
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={() => void submit()}
            style={{
              alignItems: 'center',
              backgroundColor: theme.color.primary,
              borderRadius: theme.radius.chip,
              flexDirection: 'row',
              gap: space.sm,
              justifyContent: 'center',
              minHeight: 54,
            }}
          >
            {busy ? (
              <ActivityIndicator color={theme.color.onPrimary} />
            ) : (
              <>
                <Text tone="onPrimary" variant="bodyStrong">
                  Sign in
                </Text>
                <Icon color={theme.color.onPrimary} ios="arrow.right" md="arrow_forward" size={17} />
              </>
            )}
          </PressableScale>
          <Text style={{ textAlign: 'center' }} tone="muted" variant="secondary">
            Citius Holidays sets up staff accounts. If you cannot sign in, contact HR or your manager.
          </Text>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}
