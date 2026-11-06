import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';

import { StaffSessionProvider, useStaffSession } from './session';

const tmAccess = (staffId: string, roles = ['Tour Manager']) => ({
  allowed: true,
  email: `${staffId}@example.test`,
  name: `Synthetic ${staffId}`,
  permissions: [],
  roles,
  staffId,
});

const mockAuth = { access: undefined as unknown, isAuthenticated: true, isLoading: false };
const mockSession = { data: { session: { id: 's' } } as unknown, error: null as unknown, isPending: false };
const mockSignOut = jest.fn(async () => undefined);
const mockClearLocalAuthSession = jest.fn(async () => undefined);
const mockDeleteAllReceipts = jest.fn();
let mockStore: KeyValueStore;

jest.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: mockAuth.isAuthenticated, isLoading: mockAuth.isLoading }),
  useQuery: (_ref: unknown, args: unknown) => (args === 'skip' ? undefined : mockAuth.access),
}));
jest.mock('@/lib/clients', () => ({
  APP_SCHEME: 'citiusconnect',
  clients: {
    auth: {
      getCookie: async () => 'better-auth.session_token=synthetic',
      signOut: () => mockSignOut(),
      useSession: () => mockSession,
    },
  },
}));
jest.mock('@/lib/auth-storage', () => ({ clearLocalAuthSession: () => mockClearLocalAuthSession() }));
jest.mock('@/features/expenses/receipt-files', () => ({ deleteAllReceipts: () => mockDeleteAllReceipts() }));
jest.mock('@/lib/network', () => ({ useOnline: () => true }));
jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));

const handles: { session: ReturnType<typeof useStaffSession> | null } = { session: null };
function Probe() {
  const session = useStaffSession();
  useEffect(() => {
    handles.session = session;
  });
  return <Text>{`gate:${session.gate.kind}`}</Text>;
}

async function renderSession() {
  return render(
    <AppStoreProvider fallback={null}>
      <StaffSessionProvider>
        <Probe />
      </StaffSessionProvider>
    </AppStoreProvider>
  );
}

beforeEach(async () => {
  mockStore = jest.requireActual('@/lib/storage/memory-store').createMemoryStore();
  mockAuth.access = undefined;
  mockAuth.isAuthenticated = true;
  mockSession.data = { session: { id: 's' } };
  mockSession.error = null;
  mockSignOut.mockReset().mockResolvedValue(undefined);
  mockClearLocalAuthSession.mockClear();
  mockDeleteAllReceipts.mockClear();
});

describe('staff session', () => {
  it("wipes the previous tour manager's data before showing anything to a different one", async () => {
    await mockStore.setJSON('session:verifiedStaff', { name: 'A', roles: ['Tour Manager'], staffId: 'staff_a', verifiedAt: 1 });
    await mockStore.setJSON('pack:jc_a', { roster: ['someone on trip A'] });
    await mockStore.setJSON('outbox:expenses', [{ id: 'exp_a' }]);
    mockAuth.access = tmAccess('staff_b');
    await renderSession();
    expect(await screen.findByText('gate:staff')).toBeOnTheScreen();
    expect(await mockStore.getJSON('pack:jc_a')).toBeNull();
    expect(await mockStore.getJSON('outbox:expenses')).toBeNull();
    expect(mockDeleteAllReceipts).toHaveBeenCalled();
    expect(await mockStore.getJSON('session:verifiedStaff')).toMatchObject({ staffId: 'staff_b' });
  });

  it("keeps the same tour manager's data and refreshes the saved roles and time", async () => {
    await mockStore.setJSON('session:verifiedStaff', { name: 'A', roles: ['Tour Manager'], staffId: 'staff_a', verifiedAt: 1 });
    await mockStore.setJSON('pack:jc_a', { roster: [] });
    mockAuth.access = tmAccess('staff_a', ['Tour Manager', 'Operations']);
    await renderSession();
    expect(await screen.findByText('gate:staff')).toBeOnTheScreen();
    await waitFor(async () =>
      expect(await mockStore.getJSON('session:verifiedStaff')).toMatchObject({ roles: ['Tour Manager', 'Operations'] })
    );
    const saved = await mockStore.getJSON<{ verifiedAt: number }>('session:verifiedStaff');
    expect(saved?.verifiedAt).toBeGreaterThan(1);
    expect(await mockStore.getJSON('pack:jc_a')).toEqual({ roster: [] });
  });

  it('wipes the cached verification and data when the account is no longer staff', async () => {
    await mockStore.setJSON('session:verifiedStaff', { name: 'A', roles: ['Tour Manager'], staffId: 'staff_a', verifiedAt: 1 });
    await mockStore.setJSON('pack:jc_a', { roster: [] });
    mockAuth.access = { ...tmAccess('staff_a'), allowed: false, reason: 'NOT_STAFF', roles: [], staffId: undefined };
    await renderSession();
    expect(await screen.findByText('gate:notStaff')).toBeOnTheScreen();
    await waitFor(async () => expect(await mockStore.getJSON('session:verifiedStaff')).toBeNull());
    expect(await mockStore.getJSON('pack:jc_a')).toBeNull();
  });

  it('wipes the cached verification when the tour manager role is removed', async () => {
    await mockStore.setJSON('session:verifiedStaff', { name: 'A', roles: ['Tour Manager'], staffId: 'staff_a', verifiedAt: 1 });
    mockAuth.access = tmAccess('staff_a', ['Accounts']);
    await renderSession();
    expect(await screen.findByText('gate:notTourManager')).toBeOnTheScreen();
    await waitFor(async () => expect(await mockStore.getJSON('session:verifiedStaff')).toBeNull());
  });

  it('keeps a tour manager in offline mode on a captive network, but not once the server rejects the session', async () => {
    await mockStore.setJSON('session:verifiedStaff', { name: 'A', roles: ['Tour Manager'], staffId: 'staff_a', verifiedAt: Date.now() });
    // The device reports a connection (useOnline is true), but the token request failed.
    mockAuth.isAuthenticated = false;
    mockSession.error = new TypeError('Network request failed');
    const view = await renderSession();
    expect(await screen.findByText('gate:staff')).toBeOnTheScreen();

    mockSession.data = null;
    mockSession.error = { status: 401 };
    await view.rerender(
      <AppStoreProvider fallback={null}>
        <StaffSessionProvider>
          <Probe />
        </StaffSessionProvider>
      </AppStoreProvider>
    );
    expect(await screen.findByText('gate:signedOut')).toBeOnTheScreen();
  });

  it('signs out offline: the local session and all data are deleted even though the server is unreachable', async () => {
    await mockStore.setJSON('session:verifiedStaff', { name: 'A', roles: ['Tour Manager'], staffId: 'staff_a', verifiedAt: Date.now() });
    await mockStore.setJSON('pack:jc_a', { roster: [] });
    mockAuth.isAuthenticated = false;
    mockSession.error = new TypeError('Network request failed');
    mockSignOut.mockRejectedValue(new TypeError('Network request failed'));
    await renderSession();
    expect(await screen.findByText('gate:staff')).toBeOnTheScreen();
    await act(async () => {
      await handles.session?.signOut();
    });
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockClearLocalAuthSession).toHaveBeenCalled();
    expect(await mockStore.getJSON('pack:jc_a')).toBeNull();
    expect(await mockStore.getJSON('session:verifiedStaff')).toBeNull();
    expect(mockDeleteAllReceipts).toHaveBeenCalled();
  });
});
