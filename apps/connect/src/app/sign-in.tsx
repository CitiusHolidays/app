import { Banner, Button, space, Text, useAppTheme } from '@citius/ui';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { PageTitle, Screen, TextField, TopTint } from '@/components/kit';
import { clients } from '@/lib/clients';
import { logEvent } from '@/lib/safe-log';
import { useAnnounce } from '@/lib/use-announce';

/** Staff sign in with their existing email and password. There is no sign-up in this app. */
export default function SignIn() {
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useAnnounce(problem);

  const submit = async () => {
    if (!clients || busy) return;
    if (!email.trim() || !password) {
      setProblem('Enter your work email and password.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const { error } = await clients.auth.signIn.email({ email: email.trim(), password });
      if (error) {
        logEvent('auth.sign-in-refused');
        setProblem(
          error.status === 429
            ? 'Too many attempts. Wait a minute, then try again.'
            : 'That email and password do not match a Citius account.'
        );
      }
    } catch (error) {
      logEvent('auth.sign-in-failed', error);
      setProblem('Could not reach Citius. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ backgroundColor: theme.color.ground, flex: 1 }}>
      <TopTint height={420} />
      <Screen
        header={
          <View style={{ gap: space.md, paddingTop: space.xxl * 2 }}>
            <PageTitle kicker="Staff" title="Citius Connect" />
            <Text tone="muted" variant="secondary">
              Sign in with your Citius staff account.
            </Text>
          </View>
        }
        style={{ backgroundColor: 'transparent' }}
        tabBar={false}
      >
        <View style={{ gap: space.md, paddingTop: space.sm }}>
          <TextField
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            label="Work email"
            onChangeText={setEmail}
            returnKeyType="next"
            textContentType="username"
            value={email}
          />
          <TextField
            autoCapitalize="none"
            autoComplete="current-password"
            label="Password"
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            returnKeyType="go"
            secureTextEntry
            textContentType="password"
            value={password}
          />
        </View>
        {problem ? (
          <Banner tone="attention">
            <Text accessibilityLiveRegion="polite" variant="secondary">
              {problem}
            </Text>
          </Banner>
        ) : null}
        <Button busy={busy} label="Sign in" onPress={() => void submit()} />
        <Text style={{ textAlign: 'center' }} tone="muted" variant="secondary">
          Staff accounts are set up by Citius. If you cannot sign in, contact HR or your manager.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
