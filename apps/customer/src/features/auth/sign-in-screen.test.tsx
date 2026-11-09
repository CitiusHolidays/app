import { act, fireEvent, screen } from '@testing-library/react-native';

import SignIn from '@/app/sign-in';
import { renderWithTheme } from '@/test/render';

import { initialSignIn, signInBody, signInReducer } from './sign-in-flow';

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { back: jest.fn(), canGoBack: () => false, dismissTo: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/features/session/session', () => ({
  PENDING_INVITE_KEY: 'session:pendingInvite',
  RETURN_TO_KEY: 'session:returnTo',
  SERVER_STALL_MS: 8000,
  useCustomerSession: () => ({ gate: { kind: 'signedOut' } }),
}));
jest.mock('@/lib/app-store', () => ({ useStoredValue: (_key: string, initial: unknown) => [initial, jest.fn(), true] }));
jest.mock('@/features/auth/methods', () => ({
  isEmail: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()),
  requestEmailLink: jest.fn(),
  SIGN_IN_METHODS: [
    { available: true, id: 'email' },
    { available: false, id: 'sms' },
  ],
  verifyEmailLink: jest.fn(),
}));
jest.mock('@/components/sign-in-hero', () => ({ SignInHero: () => null }));
jest.mock('@/components/motion-views', () => {
  const { View } = jest.requireActual('react-native');
  return { Pop: View, Rise: View };
});
jest.mock('@/lib/haptic', () => ({ haptic: jest.fn() }));
jest.mock('@/i18n/i18n', () => {
  const { en } = jest.requireActual('@/i18n/locales/en');
  const t = (key: string, vars: Record<string, string> = {}) =>
    (en[key] as string).replace(/\{(\w+)\}/g, (_match: string, name: string) => vars[name] ?? '');
  return { useI18n: () => ({ t }) };
});

const { requestEmailLink } = jest.requireMock<{ requestEmailLink: jest.Mock }>('@/features/auth/methods');

describe('sign-in screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    requestEmailLink.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  async function sendTo(email: string) {
    await fireEvent.changeText(screen.getByLabelText('Email address'), email);
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  }

  it('says why "Send it again" did not go out, on the "check your email" view', async () => {
    requestEmailLink.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, reason: 'network' });
    await renderWithTheme(<SignIn />);
    await sendTo('asha@example.com');
    expect(screen.getByText('Check your email')).toBeOnTheScreen();
    await act(async () => jest.advanceTimersByTime(31_000));
    await fireEvent.press(screen.getByRole('button', { name: 'Send it again' }));
    expect(requestEmailLink).toHaveBeenLastCalledWith('asha@example.com', null);
    expect(screen.getByText('Could not reach Citius Holidays. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByText('Check your email')).toBeOnTheScreen();
  });

  it('starts "Use a different email" on a clean form', async () => {
    requestEmailLink.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, reason: 'rate-limited' });
    await renderWithTheme(<SignIn />);
    await sendTo('asha@example.com');
    await act(async () => jest.advanceTimersByTime(31_000));
    await fireEvent.press(screen.getByRole('button', { name: 'Send it again' }));
    expect(screen.getByText('Too many attempts. Wait a minute, then try again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Email address').props.value).toBe('');
    expect(screen.queryByText('Too many attempts. Wait a minute, then try again.')).toBeNull();
  });
});

describe('sign-in flow', () => {
  it('opens a link before anything else, and holds "signing you in" until the session is live', () => {
    const opened = signInReducer(initialSignIn(true), { link: { kind: 'opened' }, type: 'link' });
    expect(signInBody(initialSignIn(true), false)).toBe('verifying');
    expect(signInBody(opened, false)).toBe('verifying');
    expect(signInBody(opened, true)).toBe('form');
  });

  it('keeps "check your email" while a resend is out, and comes back to it if it fails', () => {
    const sent = signInReducer(initialSignIn(false), { at: 1, to: 'a@b.co', type: 'sent' });
    const resending = signInReducer(sent, { type: 'sending' });
    expect(signInBody(resending, false)).toBe('sent');
    const failed = signInReducer(resending, { problem: 'signIn.network', type: 'send-failed' });
    expect(failed.send).toEqual({ at: 1, kind: 'sent', problem: 'signIn.network', sending: false, to: 'a@b.co' });
  });

  it('clears a problem when the address is edited', () => {
    const refused = signInReducer(initialSignIn(false), { problem: 'signIn.emailInvalid', type: 'refused-input' });
    expect(signInReducer(refused, { type: 'edited' }).send.problem).toBeNull();
  });
});
