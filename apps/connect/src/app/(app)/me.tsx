import { Banner, Button, StatusPill, type StatusKind, space, Text, useAppTheme } from '@citius/ui';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Avatar, ListCard, Row, Screen, SectionTitle, Tag } from '@/components/kit';
import type { OutboxItem } from '@/features/expenses/outbox';
import { useOutbox } from '@/features/expenses/outbox-context';
import { useStaff, useStaffSession } from '@/features/gate/session';
import { TRIP_PACK_TTL_DAYS } from '@/features/trip-pack/trip-pack';
import { useAppStore } from '@/lib/app-store';

function syncPill(items: OutboxItem[]): { kind: StatusKind; label: string; text: string } {
  const attention = items.filter((item) => item.status === 'needsAttention').length;
  const waiting = items.filter((item) => item.status === 'pending').length;
  if (attention > 0) {
    return { kind: 'attention', label: 'Needs attention', text: `${attention} ${attention === 1 ? 'expense needs' : 'expenses need'} you on the Expenses tab.` };
  }
  if (waiting > 0) {
    return { kind: 'neutral', label: 'Waiting', text: `${waiting} ${waiting === 1 ? 'expense is' : 'expenses are'} waiting to send.` };
  }
  return { kind: 'good', label: 'All sent', text: 'Every expense on this phone has been sent.' };
}

/** The tour manager's own card, the phone's saved data, and sign out. */
export default function Me() {
  const theme = useAppTheme();
  const staff = useStaff();
  const { gate, signOut } = useStaffSession();
  const { persistent } = useAppStore();
  const { items } = useOutbox();
  const [busy, setBusy] = useState(false);
  const unsent = items.filter((item) => item.status !== 'done').length;
  const sync = syncPill(items);
  const version = Constants.expoConfig?.version ?? 'Unknown';

  const doSignOut = () => {
    setBusy(true);
    void signOut().finally(() => setBusy(false));
  };
  const confirmSignOut = () => {
    const warning = unsent
      ? `${unsent} expense${unsent === 1 ? ' has' : 's have'} not been sent yet. Signing out deletes ${unsent === 1 ? 'it' : 'them'} and the receipt photos from this phone.`
      : 'Signing out deletes the saved trip packs, headcounts and announcements from this phone.';
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
      {gate.kind === 'staff' && gate.offline ? (
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
            subtitle="Receipt photos wait in the app's cache, which is left out of phone backups, and are deleted once the expense is sent. No passport or visa files are ever saved here, only their status."
            subtitleLines={0}
            title="Receipts and documents"
          />
        </ListCard>
      </View>
      <View style={{ gap: space.md }}>
        <SectionTitle>App</SectionTitle>
        <ListCard>
          <Row subtitle={sync.text} subtitleLines={0} title="Expense sync" trailing={<StatusPill kind={sync.kind} label={sync.label} />} />
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
