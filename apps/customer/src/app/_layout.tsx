import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { customerTheme, face, Text, ThemeProvider, themeForScript } from '@citius/ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useMemo } from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';

import { AppErrorBoundary } from '@/components/error-boundary';
import { CustomerSessionProvider, useCustomerSession } from '@/features/session/session';
import { I18nProvider, useI18n } from '@/i18n/i18n';
import { AppStoreProvider } from '@/lib/app-store';
import { clients } from '@/lib/clients';
import { publicConfig } from '@/lib/env';

// A known React Native dev-only warning from native scroll animations; it has no effect in release.
LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate` with no listeners registered']);

const ANDROID_FACES = {
  InstrumentSerif_400Regular,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  JetBrainsMono_500Medium,
};

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Waiting() {
  return (
    <View
      accessibilityLabel="Citius"
      style={{ alignItems: 'center', backgroundColor: customerTheme.color.ground, flex: 1, justifyContent: 'center' }}
    >
      <ActivityIndicator color={customerTheme.color.primary} />
    </View>
  );
}

function MissingConfiguration() {
  const { t } = useI18n();
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View style={{ backgroundColor: customerTheme.color.ground, flex: 1, gap: 12, justifyContent: 'center', padding: 24 }}>
      <Text accessibilityRole="header" variant="title">
        {t('config.missingTitle')}
      </Text>
      <Text>{t('config.missingBody', { names: publicConfig.ok ? '' : publicConfig.missing.join(', ') })}</Text>
    </View>
  );
}

/** The theme follows the chosen language's script: Indic scripts get taller lines. */
function ScriptTheme({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  const theme = useMemo(() => themeForScript(customerTheme, language.script), [language.script]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

function Shell() {
  const { gate } = useCustomerSession();
  const { t } = useI18n();
  useEffect(() => {
    if (gate.kind !== 'loading') {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [gate.kind]);
  if (gate.kind === 'loading') {
    return <Waiting />;
  }
  const signedIn = gate.kind === 'signedIn';
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: customerTheme.color.ground },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: customerTheme.color.ground },
        headerTintColor: customerTheme.color.ink,
        headerTitleStyle: { ...face(customerTheme, 'semibold'), fontSize: 17 },
        // Dark icons on the cream ground. Every screen states its style: one left unset falls
        // back to whatever the last screen used (or light on Android), so 'light' would stick.
        statusBarStyle: 'dark',
      }}
    >
      {/* Open whether signed in or not: email links and invite links land here. */}
      <Stack.Screen name="sign-in" options={{ headerShown: false, statusBarStyle: 'light' }} />
      <Stack.Screen name="invite" options={{ headerShown: false }} />
      {/* The tabs redirect to sign-in themselves when signed out, so a cold start on "/" lands
          on sign-in rather than on the router's alphabetical fallback. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Protected guard={signedIn} redirectTo="/sign-in">
        {/* The trip screen sets its own status bar: light over the photo, dark on the cream sheet. */}
        <Stack.Screen name="trip/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[id]/plan" options={{ title: t('trip.plan') }} />
        <Stack.Screen name="trip/[id]/updates" options={{ title: t('trip.updates') }} />
        <Stack.Screen name="invite-entry" options={{ presentation: 'modal', title: t('invite.enterTitle') }} />
        <Stack.Screen name="language" options={{ title: t('language.title') }} />
        <Stack.Screen name="delete-account" options={{ title: t('delete.title') }} />
      </Stack.Protected>
    </Stack>
  );
}

function GuardedShell() {
  const { signOut } = useCustomerSession();
  return (
    <AppErrorBoundary onSignOut={signOut}>
      <Shell />
    </AppErrorBoundary>
  );
}

export default function RootLayout() {
  // iOS uses Apple's system faces. Elsewhere the splash stays up until the bundled faces are
  // ready; a font error falls back to system type.
  const [fontsLoaded, fontError] = useFonts(Platform.OS === 'ios' ? {} : ANDROID_FACES);
  if (!fontsLoaded && !fontError) {
    return null;
  }
  return (
    <AppStoreProvider fallback={<Waiting />}>
      <I18nProvider>
        <ScriptTheme>
          <StatusBar style="dark" />
          {clients ? (
            <ConvexBetterAuthProvider authClient={clients.auth} client={clients.convex}>
              <CustomerSessionProvider>
                <GuardedShell />
              </CustomerSessionProvider>
            </ConvexBetterAuthProvider>
          ) : (
            <MissingConfiguration />
          )}
        </ScriptTheme>
      </I18nProvider>
    </AppStoreProvider>
  );
}
