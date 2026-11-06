import { Button } from '@citius/ui';
import { useState } from 'react';

import { MessageScreen } from '@/components/kit';
import { useStaffSession } from '@/features/gate/session';

export default function NotTourManager() {
  const { signOut } = useStaffSession();
  const [busy, setBusy] = useState(false);
  return (
    <MessageScreen
      actions={
        <Button
          busy={busy}
          label="Sign out"
          onPress={() => {
            setBusy(true);
            void signOut().finally(() => setBusy(false));
          }}
        />
      }
      detail="Office work stays on the Citius portal. If you are a tour manager, ask HR to add the Tour Manager role to your staff record, then sign in again."
      icon={{ ios: 'suitcase', md: 'luggage' }}
      text="You are signed in with a Citius staff account, but it does not have the Tour Manager role, so Citius Connect has nothing to show."
      title="This app is for tour managers"
    />
  );
}
