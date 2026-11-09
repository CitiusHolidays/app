import { Banner, Button, StatusPill, space, Text, useAppTheme } from '@citius/ui';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Avatar, ListCard, Row, Screen, SectionTitle, Tag } from '@/components/kit';
import { useOutbox } from '@/features/expenses/outbox-context';
import { useFieldSync } from '@/features/field-sync/field-sync-context';
import { useCanReachServer } from '@/features/gate/reach';
import { useStaff, useStaffSession } from '@/features/gate/session';
import { signOutWarning, syncStatus, unsentWork } from '@/features/gate/unsent';
import { TRIP_PACK_TTL_DAYS } from '@/features/trip-pack/trip-pack';
import { useAppStore } from '@/lib/app-store';

/** The tour manager's own card, the phone's saved data, and sign out. */
export default function Me() {
  const theme = useAppTheme();
  const staff = useStaff();
  const { signOut } = useStaffSession();
  const { persistent } = useAppStore();
  const outbox = useOutbox();
  const fieldSync = useFieldSync();
  const [busy, setBusy] = useState(false);
  const unsent = unsentWork(fieldSync.items, outbox.items);
  const sync = syncStatus(unsent);
  // The same rule as the freshness notice: no network, or a server that stopped answering.
  const offline = !useCanReachServer();
  const version = Constants.expoConfig?.version ?? 'Unknown';

  const doSignOut = () => {
    setBusy(true);
    void signOut().finally(() => setBusy(false));
  };
  const confirmSignOut = () => {
    const warning = signOutWarning(unsent);
    if (Platform.OS === 'web') {
      doSignOut();
      return;
    }
    Alert.alert('Sign out?', warning, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: doSignOut, style: 'destructive', text: 'Sign out' },
    ]);
  };

  return (
    <Screen title="Me">
      <View
        accessible
        accessibilityLabel={`${staff.name}, ${staff.roles.join(', ') || 'No role yet'}`}
        style={{ backgroundColor: theme.color.dark, borderRadius: theme.radius.surface, gap: space.lg, padding: space.xl - 4 }}
      >
        <Avatar name={staff.name} size={64} tone="dark" />
        <View style={{ gap: space.md }}>
          <Text numberOfLines={2} tone="onDark" variant="section">
            {staff.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {staff.roles.length > 0 ? (
              staff.roles.map((role) => <Tag key={role} label={role} tone="dark" />)
            ) : (
              <Tag label="No role yet" tone="dark" />
            )}
          </View>
        </View>
      </View>
      {offline ? (
        <Banner tone="attention">
          <Text variant="secondary">Offline. Your access is checked again when you reconnect.</Text>
        </Banner>
      ) : null}
      <View style={{ gap: space.md }}>
        <SectionTitle>On this phone</SectionTitle>
        <ListCard>
          <Row
            subtitle={
              persistent
                ? `Trip packs, headcounts, announcements and unsent expenses are stored encrypted. Trip packs are deleted ${TRIP_PACK_TTL_DAYS} days after the trip ends.`
                : 'This build cannot encrypt saved data, so nothing is kept after the app closes and offline use is off.'
            }
            subtitleLines={0}
            title="Offline data"
            trailing={<StatusPill kind={persistent ? 'good' : 'attention'} label={persistent ? 'Encrypted' : 'Off'} />}
          />
          <Row
            last
            subtitle="Receipt photos wait in the app's cache, which is left out of phone backups, and are deleted once the expense is sent. Passports are never saved: a PDF scan is held in a temporary cache file only while it is on screen, and deleted when you close it or leave the app."
            subtitleLines={0}
            title="Receipts and documents"
          />
        </ListCard>
      </View>
      <View style={{ gap: space.md }}>
        <SectionTitle>App</SectionTitle>
        <ListCard>
          <Row subtitle={sync.text} subtitleLines={0} title="Sync to the office" trailing={<StatusPill kind={sync.kind} label={sync.label} />} />
          <Row
            accessibilityLabel={`App version, ${version}`}
            last
            title="App version"
            trailing={
              <Text accessibilityElementsHidden importantForAccessibility="no" tabular tone="muted" variant="secondary">
                {version}
              </Text>
            }
          />
        </ListCard>
      </View>
      <Button busy={busy} label="Sign out" onPress={confirmSignOut} variant="secondary" />
    </Screen>
  );
}
