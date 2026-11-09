import { Button } from '@citius/ui';
import { useState } from 'react';

/** Sign out, busy until the device has signed out (the server, the session and the data). */
export function SignOutButton({ onSignOut, variant }: { onSignOut: () => Promise<void>; variant?: 'primary' | 'secondary' }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      busy={busy}
      label="Sign out"
      onPress={() => {
        setBusy(true);
        void onSignOut().finally(() => setBusy(false));
      }}
      variant={variant}
    />
  );
}
