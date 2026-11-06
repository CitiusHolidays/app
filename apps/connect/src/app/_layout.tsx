import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { staffTheme, Text, ThemeProvider } from '@citius/ui';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppErrorBoundary } from '@/components/error-boundary';
import { OutboxProvider } from '@/features/expenses/outbox-context';
import { StaffSessionProvider, useStaffSession } from '@/features/gate/session';
import { TripsProvider } from '@/features/trips/trips-context';
import { AppStoreProvider } from '@/lib/app-store';
import { clients } from '@/lib/clients';
import { publicConfig } from '@/lib/env';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Waiting() {
  return (
    <View
      accessibilityLabel="Loading Citius Connect"
      style={{ alignItems: 'center', backgroundColor: staffTheme.color.ground, flex: 1, justifyContent: 'center' }}
    >
      <ActivityIndicator color={staffTheme.color.primary} />
    </View>
  );
}

function MissingConfiguration() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View style={{ backgroundColor: staffTheme.color.ground, flex: 1, gap: 12, justifyContent: 'center', padding: 24 }}>
      <Text accessibilityRole="header" variant="title">
        Citius Connect is not configured
      </Text>
      <Text>
        This build has no backend address. Set {publicConfig.ok ? '' : publicConfig.missing.join(' and ')} in .env.local and
        restart the bundler.
      </Text>
    </View>
  );
}

/** Trip data and the expense outbox exist only for a verified tour manager. */
function StaffData({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  if (!enabled) {
    return children;
  }
  return (
    <TripsProvider>
      <OutboxProvider>{children}</OutboxProvider>
    </TripsProvider>
  );
}

function Shell() {
  const { gate } = useStaffSession();
  useEffect(() => {
    if (gate.kind !== 'loading') {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [gate.kind]);
  if (gate.kind === 'loading') {
    return <Waiting />;
  }
  const staff = gate.kind === 'staff';
  return (
    <StaffData enabled={staff}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: staffTheme.color.ground },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: staffTheme.color.ground },
          headerTintColor: staffTheme.color.ink,
          headerTitleStyle: { fontFamily: staffTheme.font.semibold, fontSize: 17 },
        }}
      >
        <Stack.Protected guard={gate.kind === 'signedOut'}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={gate.kind === 'notStaff'}>
          <Stack.Screen name="not-staff" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={gate.kind === 'notTourManager'}>
          <Stack.Screen name="not-tour-manager" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={staff}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="headcount" options={{ title: 'Headcount' }} />
          <Stack.Screen name="announce" options={{ presentation: 'modal', title: 'New announcement' }} />
          <Stack.Screen name="announcement/[id]" options={{ title: 'Announcement' }} />
          <Stack.Screen name="expense-new" options={{ presentation: 'modal', title: 'New expense' }} />
          <Stack.Screen name="notification/[id]" options={{ title: 'Notification' }} />
        </Stack.Protected>
      </Stack>
    </StaffData>
  );
}

/** A query error (FORBIDDEN after deactivation, say) shows a recover / sign-out screen. */
function GuardedShell() {
  const { revoke, signOut } = useStaffSession();
  return (
    <AppErrorBoundary onRevoked={revoke} onSignOut={signOut}>
      <Shell />
    </AppErrorBoundary>
  );
}

export default function RootLayout() {
  // The splash stays up until the bundled faces are ready; a font error falls back to system type.
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
  });
  if (!fontsLoaded && !fontError) {
    return null;
  }
  if (!clients) {
    return (
      <ThemeProvider theme={staffTheme}>
        <MissingConfiguration />
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider theme={staffTheme}>
      <StatusBar style="dark" />
      <ConvexBetterAuthProvider authClient={clients.auth} client={clients.convex}>
        <AppStoreProvider fallback={<Waiting />}>
          <StaffSessionProvider>
            <GuardedShell />
          </StaffSessionProvider>
        </AppStoreProvider>
      </ConvexBetterAuthProvider>
    </ThemeProvider>
  );
}
