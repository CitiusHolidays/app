import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { StillConnecting } from './still-connecting';

const mockRetry = jest.fn();
const mockSignOut = jest.fn(async () => undefined);
jest.mock('./session', () => ({ useStaffSession: () => ({ retry: mockRetry, signOut: mockSignOut }) }));

describe('still connecting', () => {
  it('offers a retry and a way out instead of a bare spinner', async () => {
    await renderWithTheme(<StillConnecting />);
    expect(screen.getByText('Still connecting')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRetry).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
