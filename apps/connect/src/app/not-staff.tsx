import { Button, Text } from '@citius/ui';
import { useState } from 'react';

import { Screen } from '@/components/kit';
import { useStaffSession } from '@/features/gate/session';

export default function NotStaff() {
  const { signOut } = useStaffSession();
  const [busy, setBusy] = useState(false);
  return (
    <Screen title="This app is for Citius staff">
      <Text>
        You are signed in, but this account is not linked to an active Citius staff record, so Citius Connect has nothing
        to show.
      </Text>
      <Text variant="secondary" tone="muted">
        If you work at Citius, ask HR to check your staff access. Travellers and clients use the Citius Holidays website.
      </Text>
      <Button
        busy={busy}
        label="Sign out"
        onPress={() => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        }}
        variant="secondary"
      />
    </Screen>
  );
}
