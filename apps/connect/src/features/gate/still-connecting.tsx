import { Button } from '@citius/ui';

import { MessageScreen } from '@/components/kit';

import { useStaffSession } from './session';
import { SignOutButton } from './sign-out-button';

/** Shown instead of an endless spinner when the server has not answered after a sign-in. */
export function StillConnecting() {
  const { retry, signOut } = useStaffSession();
  return (
    <MessageScreen
      actions={
        <>
          <Button label="Try again" onPress={retry} />
          <SignOutButton onSignOut={signOut} variant="secondary" />
        </>
      }
      detail="Check the phone's connection, then try again. Nothing saved on this phone opens until Citius confirms who is signed in."
      icon={{ ios: 'wifi.exclamationmark', md: 'wifi_off' }}
      text="Citius has not answered yet."
      title="Still connecting"
    />
  );
}
