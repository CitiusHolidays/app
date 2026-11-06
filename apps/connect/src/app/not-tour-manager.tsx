import { Button, Text } from '@citius/ui';
import { useState } from 'react';

import { Screen } from '@/components/kit';
import { useStaffSession } from '@/features/gate/session';

export default function NotTourManager() {
  const { signOut } = useStaffSession();
  const [busy, setBusy] = useState(false);
  return (
    <Screen title="This app is for tour managers">
      <Text>
        You are signed in with a Citius staff account, but it does not have the Tour Manager role, so Citius Connect has
        nothing to show.
      </Text>
      <Text variant="secondary" tone="muted">
        Office work stays on the Citius portal. If you are a tour manager, ask HR to add the Tour Manager role to your
        staff record, then sign in again.
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
