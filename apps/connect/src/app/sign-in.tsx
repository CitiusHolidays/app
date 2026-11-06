import { Banner, Button, space, Text } from '@citius/ui';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Screen, TextField } from '@/components/kit';
import { clients } from '@/lib/clients';
import { logEvent } from '@/lib/safe-log';

/** Staff sign in with their existing email and password. There is no sign-up in this app. */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen title="Citius Connect">
        <Text variant="secondary" tone="muted">
          Sign in with your Citius staff account.
        </Text>
        <View style={{ gap: space.md }}>
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
        <Text variant="secondary" tone="muted">
          Staff accounts are set up by Citius. If you cannot sign in, contact HR or your manager.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
