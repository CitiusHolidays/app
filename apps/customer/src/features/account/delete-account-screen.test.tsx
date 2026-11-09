import { act, fireEvent, screen } from '@testing-library/react-native';

import DeleteAccount from '@/app/delete-account';
import { renderWithTheme, themed } from '@/test/render';

import { deletionLinkSent, deletionProblem } from './deletion-step';

const mockState: { convex: { query: jest.Mock } } = { convex: { query: jest.fn() } };

jest.mock('convex/react', () => ({
  useConvex: () => mockState.convex,
  useConvexAuth: () => ({ isAuthenticated: true }),
  useMutation: () => jest.fn(),
  useQuery: () => ({ email: 'asha@example.com', name: 'Asha', phoneNumber: '' }),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    Stack: { Screen: () => null },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});
jest.mock('@/features/session/session', () => ({
  RETURN_TO_KEY: 'session:returnTo',
  useCustomerSession: () => ({ forget: jest.fn(), offline: false }),
}));
jest.mock('@/features/auth/methods', () => ({ requestEmailLink: jest.fn() }));
jest.mock('@/lib/env', () => ({ WEBSITE_URL: 'https://example.com' }));
jest.mock('@/lib/open-url', () => ({ openUrl: jest.fn() }));
const mockSetStored = jest.fn(async () => undefined);
jest.mock('@/lib/app-store', () => ({ useStoredValue: (_key: string, initial: unknown) => [initial, mockSetStored, true] }));
jest.mock('@/components/skeletons', () => ({ DeletionStepSkeleton: () => null }));
jest.mock('@/lib/haptic', () => ({ haptic: jest.fn() }));
jest.mock('@/lib/safe-log', () => ({ logEvent: jest.fn() }));
jest.mock('@/i18n/i18n', () => {
  const { en } = jest.requireActual('@/i18n/locales/en');
  const t = (key: string, vars: Record<string, string> = {}) =>
    (en[key] as string).replace(/\{(\w+)\}/g, (_match: string, name: string) => vars[name] ?? '');
  return { useI18n: () => ({ t }) };
});

const { requestEmailLink } = jest.requireMock<{ requestEmailLink: jest.Mock }>('@/features/auth/methods');

const TOO_MANY = 'Too many attempts. Wait a minute, then try again.';
const SENT = "Link sent to asha@example.com. Open it on this phone and you'll come straight back here.";

/** The eligibility check answers with this status. */
function answering(status: string) {
  return { query: jest.fn(async () => ({ reauthenticateBy: 1, status })) };
}

describe('delete account screen', () => {
  beforeEach(() => {
    requestEmailLink.mockReset();
    mockState.convex = answering('reauthentication_required');
  });

  it('drops a failed link request once the traveller is back and the next step shows', async () => {
    requestEmailLink.mockResolvedValueOnce({ ok: false, reason: 'rate-limited' });
    await renderWithTheme(<DeleteAccount />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Email me a link' }));
    expect(screen.getByText(TOO_MANY)).toBeOnTheScreen();

    // A link sent earlier signs the traveller in again; Convex takes up the new session.
    mockState.convex = answering('ready');
    await act(async () => screen.rerender(themed(<DeleteAccount />)));
    expect(await screen.findByRole('button', { name: 'Delete my account' })).toBeOnTheScreen();
    expect(screen.queryByText(TOO_MANY)).toBeNull();
  });

  it('keeps "Link sent" up when asking for another link fails', async () => {
    requestEmailLink.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, reason: 'network' });
    await renderWithTheme(<DeleteAccount />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Email me a link' }));
    expect(screen.getByText(SENT)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a link' }));
    expect(screen.getByText(SENT)).toBeOnTheScreen();
    expect(screen.getByText('Could not reach Citius Holidays. Check your connection and try again.')).toBeOnTheScreen();
  });
});

describe('deletion action', () => {
  it('shows a failure only on the step it happened on', () => {
    const failed = { kind: 'failed', problem: 'signIn.tooMany', sent: false, step: 'reauth' } as const;
    expect(deletionProblem(failed, 'reauth')).toBe('signIn.tooMany');
    expect(deletionProblem(failed, 'ready')).toBeNull();
  });

  it('keeps an earlier link sent while another is asked for', () => {
    expect(deletionLinkSent({ kind: 'sending-link', sent: true })).toBe(true);
    expect(deletionLinkSent({ kind: 'sending-link', sent: false })).toBe(false);
    expect(deletionLinkSent({ kind: 'deleting' })).toBe(false);
  });
});
