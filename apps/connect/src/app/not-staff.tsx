import { MessageScreen } from '@/components/kit';
import { useStaffSession } from '@/features/gate/session';
import { SignOutButton } from '@/features/gate/sign-out-button';

export default function NotStaff() {
  const { signOut } = useStaffSession();
  return (
    <MessageScreen
      actions={<SignOutButton onSignOut={signOut} />}
      detail="If you work at Citius, ask HR to check your staff access. Travellers and clients use the Citius Holidays website."
      icon={{ ios: 'person.crop.circle.badge.questionmark', md: 'person_off' }}
      text="You are signed in, but this account is not linked to an active Citius staff record, so Citius Connect has nothing to show."
      title="This app is for Citius staff"
    />
  );
}
