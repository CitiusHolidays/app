import { MessageScreen } from '@/components/kit';
import { useStaffSession } from '@/features/gate/session';
import { SignOutButton } from '@/features/gate/sign-out-button';

export default function NotTourManager() {
  const { signOut } = useStaffSession();
  return (
    <MessageScreen
      actions={<SignOutButton onSignOut={signOut} />}
      detail="Office work stays on the Citius portal. If you are a tour manager, ask HR to add the Tour Manager role to your staff record. This screen updates once HR adds the role."
      icon={{ ios: 'suitcase', md: 'luggage' }}
      text="You are signed in with a Citius staff account, but it does not have the Tour Manager role, so Citius Connect has nothing to show."
      title="This app is for tour managers"
    />
  );
}
