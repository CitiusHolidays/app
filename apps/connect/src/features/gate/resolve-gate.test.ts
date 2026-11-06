import { resolveGate } from './resolve-gate';

const NOW = Date.parse('2026-11-06T09:00:00+05:30');
const staffAccess = {
  allowed: true,
  email: 'tm.one@example.test',
  name: 'Test Tour Manager',
  permissions: ['view:jobCards'],
  roles: ['Tour Manager'],
  staffId: 'staff_1',
};

describe('resolveGate', () => {
  it('waits while the auth state is loading', () => {
    expect(
      resolveGate({ authLoading: true, hasCachedSession: false, isAuthenticated: false, now: NOW, online: true }).kind
    ).toBe('loading');
  });

  it('sends a signed-out user to sign-in', () => {
    expect(
      resolveGate({ authLoading: false, hasCachedSession: false, isAuthenticated: false, now: NOW, online: true }).kind
    ).toBe('signedOut');
  });

  it('waits for the portal access answer once authenticated', () => {
    expect(
      resolveGate({ authLoading: false, hasCachedSession: true, isAuthenticated: true, now: NOW, online: true }).kind
    ).toBe('loading');
  });

  it('shows the staff-only screen to a signed-in non-staff account', () => {
    const gate = resolveGate({
      access: { ...staffAccess, allowed: false, reason: 'NOT_STAFF', roles: [] },
      authLoading: false,
      hasCachedSession: true,
      isAuthenticated: true,
      now: NOW,
      online: true,
    });
    expect(gate.kind).toBe('notStaff');
  });

  it('lets an active staff member in with their roles', () => {
    const gate = resolveGate({
      access: staffAccess,
      authLoading: false,
      hasCachedSession: true,
      isAuthenticated: true,
      now: NOW,
      online: true,
    });
    expect(gate).toEqual({ kind: 'staff', offline: false, staff: { name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' } });
  });

  it('keeps a recently verified staff member in offline mode when the network is down', () => {
    const gate = resolveGate({
      authLoading: false,
      hasCachedSession: true,
      isAuthenticated: false,
      lastVerified: { name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1', verifiedAt: NOW - 2 * 86_400_000 },
      now: NOW,
      online: false,
    });
    expect(gate.kind).toBe('staff');
    expect(gate.kind === 'staff' && gate.offline).toBe(true);
  });

  it('does not grant offline mode after the verification window', () => {
    const gate = resolveGate({
      authLoading: false,
      hasCachedSession: true,
      isAuthenticated: false,
      lastVerified: { name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1', verifiedAt: NOW - 15 * 86_400_000 },
      now: NOW,
      online: false,
    });
    expect(gate.kind).toBe('signedOut');
  });

  it('does not grant offline mode without a stored session, or while online', () => {
    const lastVerified = { name: 'A', roles: [], staffId: 's', verifiedAt: NOW };
    expect(
      resolveGate({ authLoading: false, hasCachedSession: false, isAuthenticated: false, lastVerified, now: NOW, online: false }).kind
    ).toBe('signedOut');
    expect(
      resolveGate({ authLoading: false, hasCachedSession: true, isAuthenticated: false, lastVerified, now: NOW, online: true }).kind
    ).toBe('signedOut');
  });
});
