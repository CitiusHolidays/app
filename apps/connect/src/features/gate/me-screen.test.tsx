import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Me from '@/app/(app)/me';
import { renderWithTheme } from '@/test/render';

const mockSession = {
  gate: { kind: 'staff', offline: false, staff: { name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' } },
  online: true,
  signOut: jest.fn(async () => undefined),
};
const mockField = { items: [] as { kind: string; status: string }[] };
const mockOutbox = { items: [] as { status: string }[] };

jest.mock('@/features/gate/session', () => ({
  useStaff: () => mockSession.gate.staff,
  useStaffSession: () => mockSession,
}));
jest.mock('@/features/expenses/outbox-context', () => ({ useOutbox: () => mockOutbox }));
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => mockField }));
jest.mock('@/lib/app-store', () => ({ useAppStore: () => ({ persistent: true }) }));

beforeEach(() => {
  mockSession.online = true;
  mockSession.gate.offline = false;
  mockField.items = [];
  mockOutbox.items = [];
});

describe('me screen', () => {
  it('names unsent headcounts and announcements in the sign-out warning', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockField.items = [
      { kind: 'headcountStop', status: 'pending' },
      { kind: 'announcement', status: 'pending' },
    ];
    await renderWithTheme(<Me />);
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(alert).toHaveBeenCalledWith(
      'Sign out?',
      'Not sent to the office yet: 1 headcount and 1 announcement. Signing out deletes them from this phone.',
      expect.any(Array)
    );
    alert.mockRestore();
  });

  it('shows the offline notice when the phone has no network, not only when the server stalls', async () => {
    mockSession.online = false;
    await renderWithTheme(<Me />);
    expect(screen.getByText('Offline. Your access is checked again when you reconnect.')).toBeOnTheScreen();
  });

  it('reports headcount and announcement sync alongside expenses', async () => {
    mockField.items = [{ kind: 'headcountStop', status: 'pending' }];
    await renderWithTheme(<Me />);
    expect(screen.getByText('Waiting to send: 1 headcount.')).toBeOnTheScreen();
  });
});
