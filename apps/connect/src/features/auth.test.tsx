import { fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import SignIn from '@/app/sign-in';
import { renderWithTheme } from '@/test/render';

const mockSignInEmail = jest.fn();
jest.mock('@/lib/clients', () => ({
  clients: { auth: { signIn: { email: (...args: unknown[]) => mockSignInEmail(...args) } } },
}));

describe('sign-in screen', () => {
  beforeEach(() => mockSignInEmail.mockReset());

  it('asks for both fields before calling the server', async () => {
    await renderWithTheme(<SignIn />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your work email and password.')).toBeOnTheScreen();
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed email and offers no sign-up', async () => {
    mockSignInEmail.mockResolvedValue({ error: null });
    await renderWithTheme(<SignIn />);
    await fireEvent.changeText(screen.getByLabelText('Work email'), '  tm.one@example.test ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'synthetic-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockSignInEmail).toHaveBeenCalledWith({ email: 'tm.one@example.test', password: 'synthetic-password' });
    expect(screen.queryByText(/sign up|create account/i)).not.toBeOnTheScreen();
  });

  it('says plainly when the credentials do not match', async () => {
    mockSignInEmail.mockResolvedValue({ error: { status: 401 } });
    await renderWithTheme(<SignIn />);
    await fireEvent.changeText(screen.getByLabelText('Work email'), 'tm.one@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('That email and password do not match a Citius account.')).toBeOnTheScreen();
  });

  it('reads the error out to VoiceOver on iOS, where live regions do not exist', async () => {
    expect(Platform.OS).toBe('ios');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    mockSignInEmail.mockResolvedValue({ error: { status: 429 } });
    await renderWithTheme(<SignIn />);
    await fireEvent.changeText(screen.getByLabelText('Work email'), 'tm.one@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Too many attempts. Wait a minute, then try again.');
    expect(announce).toHaveBeenCalledWith('Too many attempts. Wait a minute, then try again.');
    announce.mockRestore();
  });
});
