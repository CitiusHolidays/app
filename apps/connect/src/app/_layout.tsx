import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { staffTheme, Text, ThemeProvider } from '@citius/ui';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

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
    <TripsProvider>
      <OutboxProvider>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: staffTheme.color.ground },
            headerBackButtonDisplayMode: 'minimal',
            headerTintColor: staffTheme.color.primary,
          }}
        >
          <Stack.Protected guard={gate.kind === 'signedOut'}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={gate.kind === 'notStaff'}>
            <Stack.Screen name="not-staff" options={{ headerShown: false }} />
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
      </OutboxProvider>
    </TripsProvider>
  );
}

export default function RootLayout() {
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
            <Shell />
          </StaffSessionProvider>
        </AppStoreProvider>
      </ConvexBetterAuthProvider>
    </ThemeProvider>
  );
}
