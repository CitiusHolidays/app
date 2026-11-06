import { Banner, Button, Text } from '@citius/ui';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { Row, Screen, SectionTitle } from '@/components/kit';
import { useOutbox } from '@/features/expenses/outbox-context';
import { useStaff, useStaffSession } from '@/features/gate/session';
import { TRIP_PACK_TTL_DAYS } from '@/features/trip-pack/trip-pack';
import { useAppStore } from '@/lib/app-store';

export default function Me() {
  const staff = useStaff();
  const { gate, signOut } = useStaffSession();
  const { persistent } = useAppStore();
  const { items } = useOutbox();
  const [busy, setBusy] = useState(false);
  const unsent = items.filter((item) => item.status !== 'done').length;

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
      <Row subtitle={staff.roles.join(', ') || 'No role yet'} title={staff.name} />
      {gate.kind === 'staff' && gate.offline ? (
        <Banner tone="attention">
          <Text variant="secondary">Offline. Your access is checked again when you reconnect.</Text>
        </Banner>
      ) : null}
      <SectionTitle>On this phone</SectionTitle>
      <Text variant="secondary">
        {persistent
          ? `Trip packs, headcounts, announcements and unsent expenses are stored encrypted. Trip packs are deleted ${TRIP_PACK_TTL_DAYS} days after the trip ends.`
          : 'This build cannot encrypt saved data, so nothing is kept after the app closes and offline use is off.'}
      </Text>
      <Text variant="secondary" tone="muted">
        Receipt photos wait in the app&apos;s cache, which is left out of phone backups, and are deleted once the expense
        is sent. No passport or visa files are ever saved here, only their status.
      </Text>
      <Button busy={busy} label="Sign out" onPress={confirmSignOut} variant="secondary" />
    </Screen>
  );
}
