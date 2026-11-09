import type { InvitePreview } from '@citius/backend/customer';
import { act, fireEvent, screen } from '@testing-library/react-native';

import Invite from '@/app/invite';
import { renderWithTheme, themed } from '@/test/render';

import { inviteView, READY, type ValidInvite } from './invite-flow';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123-_6';

const mockAnswers: { preview: InvitePreview | undefined; profile: unknown } = { preview: undefined, profile: undefined };
const mockClaim = jest.fn();

jest.mock('convex/react', () => ({
  useMutation: () => mockClaim,
  useQuery: (ref: unknown) => {
    const { customerApi: api } = jest.requireActual('@citius/backend/customer');
    return ref === api.previewInvite.ref ? mockAnswers.preview : mockAnswers.profile;
  },
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: { params: { id: string } } }) => <Text>{`opened trip ${href.params.id}`}</Text>,
    router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn() },
    useLocalSearchParams: () => ({ token: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123-_6' }),
  };
});
jest.mock('@/features/session/session', () => ({
  PENDING_INVITE_KEY: 'session:pendingInvite',
  useCustomerSession: () => ({ gate: { kind: 'signedIn', offline: false }, offline: false, signOut: jest.fn() }),
}));
jest.mock('@/lib/app-store', () => ({ useStoredValue: (_key: string, initial: unknown) => [initial, jest.fn(async () => undefined), true] }));
jest.mock('@/features/trips/reference-now', () => ({ useReferenceNow: () => 0 }));
jest.mock('@/components/invite-added', () => {
  const { Text } = jest.requireActual('react-native');
  return { AddedMoment: ({ tripId }: { tripId: string | null }) => <Text>{`all set ${tripId}`}</Text> };
});
jest.mock('@/components/destination-cover', () => ({ DestinationCover: () => null }));
jest.mock('@/components/round-button', () => ({ RoundBackButton: () => null }));
jest.mock('@/components/skeletons', () => ({ InviteSkeleton: () => null }));
jest.mock('@/components/motion-views', () => {
  const { View } = jest.requireActual('react-native');
  return { Pop: View, Rise: View };
});
jest.mock('@/lib/haptic', () => ({ haptic: jest.fn() }));
jest.mock('@/lib/safe-log', () => ({ logEvent: jest.fn() }));
jest.mock('@/i18n/i18n', () => {
  const { en } = jest.requireActual('@/i18n/locales/en');
  const t = (key: string, vars: Record<string, string> = {}) =>
    (en[key] as string).replace(/\{(\w+)\}/g, (_match: string, name: string) => vars[name] ?? '');
  return { useI18n: () => ({ dayRange: () => '1 Dec – 5 Dec 2026', t }) };
});

const valid: InvitePreview = {
  firstName: 'Asha',
  minors: [],
  status: 'valid',
  trip: { cover: null, destination: 'Bali', travelEndDate: '2026-12-05', travelStartDate: '2026-12-01' },
};

describe('invite screen', () => {
  beforeEach(() => {
    mockClaim.mockReset();
    mockAnswers.preview = valid;
    mockAnswers.profile = { email: 'asha@example.com', name: 'Asha', phoneNumber: '' };
  });

  it('shows "You\'re all set" even when the live preview turns "claimed by you" before the claim answers', async () => {
    let answer: (value: { tripId: string }) => void = () => undefined;
    mockClaim.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await renderWithTheme(<Invite />);
    await fireEvent.press(screen.getByRole('button', { name: 'Accept invite' }));
    expect(mockClaim).toHaveBeenCalledWith({ token: TOKEN });

    // The claim lands on the server; the preview subscription hears first.
    mockAnswers.preview = { status: 'claimed_by_you', tripId: 'trip-1' };
    await screen.rerender(themed(<Invite />));
    expect(screen.queryByText('opened trip trip-1')).toBeNull();
    expect(screen.getByText('Hello Asha')).toBeOnTheScreen();

    await act(async () => answer({ tripId: 'trip-1' }));
    expect(screen.getByText('all set trip-1')).toBeOnTheScreen();
  });

  it('opens the trip at once when the invite was already accepted on this account', async () => {
    mockAnswers.preview = { status: 'claimed_by_you', tripId: 'trip-1' };
    await renderWithTheme(<Invite />);
    expect(screen.getByText('opened trip trip-1')).toBeOnTheScreen();
  });

  it('says why Accept failed and lets the traveller try again', async () => {
    mockClaim.mockRejectedValueOnce(new Error('offline'));
    await renderWithTheme(<Invite />);
    await fireEvent.press(screen.getByRole('button', { name: 'Accept invite' }));
    expect(screen.getByText('The invite could not be accepted. Try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Accept invite' })).toBeEnabled();
  });
});

describe('invite view', () => {
  it('maps every preview to one view', () => {
    expect(inviteView(undefined, READY)).toEqual({ kind: 'loading' });
    expect(inviteView({ status: 'expired' }, READY)).toEqual({ kind: 'refused', reason: 'expired' });
    expect(inviteView({ status: 'used' }, READY)).toEqual({ kind: 'refused', reason: 'used' });
    expect(inviteView({ status: 'invalid' }, READY)).toEqual({ kind: 'refused', reason: 'invalid' });
    expect(inviteView(valid, READY)).toEqual({ accepting: false, invite: valid, kind: 'invite', problem: null });
  });

  it('holds the accepted invite while Accept is out, whatever the preview says', () => {
    expect(inviteView({ status: 'used' }, { invite: valid as ValidInvite, kind: 'accepting' })).toMatchObject({
      accepting: true,
      kind: 'invite',
    });
  });
});
