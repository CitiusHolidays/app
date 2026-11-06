import { type GateInput, resolveGate, sessionRejectedByServer, verificationStep } from './resolve-gate';

const NOW = Date.parse('2026-11-06T09:00:00+05:30');
const staffAccess = {
  allowed: true,
  email: 'tm.one@example.test',
  name: 'Test Tour Manager',
  permissions: ['view:jobCards'],
  roles: ['Tour Manager'],
  staffId: 'staff_1',
};
const verifiedTm = { name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1', verifiedAt: NOW - 2 * 86_400_000 };

function gate(input: Partial<GateInput>) {
  return resolveGate({
    authLoading: false,
    hasCachedSession: false,
    isAuthenticated: false,
    now: NOW,
    sessionRejected: false,
    ...input,
  });
}

describe('resolveGate', () => {
  it('waits while the auth state is loading', () => {
    expect(gate({ authLoading: true }).kind).toBe('loading');
  });

  it('opens the saved trip pack when the server has not answered in time (a hanging connection)', () => {
    // Still waiting on the token check: after the stall, the offline window decides.
    expect(gate({ authLoading: true, hasCachedSession: true, lastVerified: verifiedTm, stalled: true })).toMatchObject({
      kind: 'staff',
      offline: true,
    });
    // Signed in, but the staff-access answer never arrives.
    expect(
      gate({ hasCachedSession: true, isAuthenticated: true, lastVerified: verifiedTm, stalled: true })
    ).toMatchObject({ kind: 'staff', offline: true });
  });

  it('keeps waiting on a stall when the phone has nothing it may show', () => {
    expect(gate({ authLoading: true, stalled: true }).kind).toBe('loading');
    expect(gate({ authLoading: true, hasCachedSession: true, stalled: true }).kind).toBe('loading');
    const old = { ...verifiedTm, verifiedAt: NOW - 30 * 86_400_000 };
    expect(gate({ authLoading: true, hasCachedSession: true, lastVerified: old, stalled: true }).kind).toBe('loading');
    expect(gate({ authLoading: true, hasCachedSession: true, lastVerified: verifiedTm, stalled: true, sessionRejected: true }).kind).toBe(
      'loading'
    );
  });

  it('sends a signed-out user to sign-in', () => {
    expect(gate({ sessionRejected: true }).kind).toBe('signedOut');
    expect(gate({}).kind).toBe('signedOut');
  });

  it('waits for the portal access answer once authenticated', () => {
    expect(gate({ hasCachedSession: true, isAuthenticated: true }).kind).toBe('loading');
  });

  it('shows the staff-only screen to a signed-in non-staff account', () => {
    const result = gate({
      access: { ...staffAccess, allowed: false, reason: 'NOT_STAFF', roles: [] },
      hasCachedSession: true,
      isAuthenticated: true,
    });
    expect(result.kind).toBe('notStaff');
  });

  it('refuses active staff who are not tour managers', () => {
    const result = gate({
      access: { ...staffAccess, roles: ['Operations'] },
      hasCachedSession: true,
      isAuthenticated: true,
      lastVerified: { ...verifiedTm, roles: ['Operations'] },
    });
    expect(result.kind).toBe('notTourManager');
  });

  it('lets an active tour manager in once this device holds their verification', () => {
    const result = gate({ access: staffAccess, hasCachedSession: true, isAuthenticated: true, lastVerified: verifiedTm });
    expect(result).toEqual({ kind: 'staff', offline: false, staff: { name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' } });
  });

  it("holds a different staff member at loading until the previous user's data is wiped", () => {
    const otherUser = { ...staffAccess, email: 'tm.two@example.test', staffId: 'staff_2' };
    expect(gate({ access: otherUser, hasCachedSession: true, isAuthenticated: true, lastVerified: verifiedTm }).kind).toBe('loading');
    expect(gate({ access: otherUser, hasCachedSession: true, isAuthenticated: true, lastVerified: null }).kind).toBe('loading');
  });

  it('keeps a recently verified tour manager in offline mode when the device is offline', () => {
    const result = gate({ hasCachedSession: true, lastVerified: verifiedTm });
    expect(result.kind).toBe('staff');
    expect(result.kind === 'staff' && result.offline).toBe(true);
  });

  it('uses the offline window on a weak or captive network, not only when the device reports offline', () => {
    // Device reports a connection, but the session or token request failed: not a rejection.
    const result = gate({ hasCachedSession: true, lastVerified: verifiedTm, sessionRejected: false });
    expect(result.kind === 'staff' && result.offline).toBe(true);
  });

  it('sends the user to sign-in when the server explicitly rejects the session', () => {
    expect(gate({ hasCachedSession: true, lastVerified: verifiedTm, sessionRejected: true }).kind).toBe('signedOut');
  });

  it('does not grant offline mode after the verification window', () => {
    const result = gate({ hasCachedSession: true, lastVerified: { ...verifiedTm, verifiedAt: NOW - 15 * 86_400_000 } });
    expect(result.kind).toBe('signedOut');
  });

  it('does not grant offline mode without a stored session', () => {
    expect(gate({ hasCachedSession: false, lastVerified: verifiedTm }).kind).toBe('signedOut');
  });

  it('does not open the offline trip pack for a cached record without the tour manager role', () => {
    expect(gate({ hasCachedSession: true, lastVerified: { ...verifiedTm, roles: ['Accounts'] } }).kind).toBe('notTourManager');
  });
});

describe('sessionRejectedByServer', () => {
  it('treats "no session" and 401/403 answers as a rejection', () => {
    expect(sessionRejectedByServer({ data: null, error: null, isPending: false })).toBe(true);
    expect(sessionRejectedByServer({ data: null, error: { status: 401 }, isPending: false })).toBe(true);
    expect(sessionRejectedByServer({ data: null, error: { status: 403 }, isPending: false })).toBe(true);
  });

  it('does not treat a network failure, a server error or a pending check as a rejection', () => {
    expect(sessionRejectedByServer({ data: null, error: new TypeError('Network request failed'), isPending: false })).toBe(false);
    expect(sessionRejectedByServer({ data: null, error: { status: 502 }, isPending: false })).toBe(false);
    expect(sessionRejectedByServer({ data: { session: { id: 's' } }, error: { status: 0 }, isPending: false })).toBe(false);
    expect(sessionRejectedByServer({ data: null, error: null, isPending: true })).toBe(false);
  });
});

describe('verificationStep', () => {
  const stored = { name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1', verifiedAt: NOW - 86_400_000 };

  it('re-saves roles and the verification time on every successful check', () => {
    const access = { ...staffAccess, roles: ['Tour Manager', 'Operations'] };
    expect(verificationStep(access, stored, NOW)).toEqual({
      kind: 'store',
      record: { name: 'Test Tour Manager', roles: ['Tour Manager', 'Operations'], staffId: 'staff_1', verifiedAt: NOW },
      wipeFirst: false,
    });
  });

  it("wipes another staff member's data before saving a new staff id", () => {
    const step = verificationStep({ ...staffAccess, staffId: 'staff_2' }, stored, NOW);
    expect(step).toMatchObject({ kind: 'store', record: { staffId: 'staff_2' }, wipeFirst: true });
    expect(verificationStep(staffAccess, null, NOW)).toMatchObject({ kind: 'store', wipeFirst: true });
  });

  it('wipes everything when the account is no longer staff or no longer a tour manager', () => {
    expect(verificationStep({ ...staffAccess, allowed: false, reason: 'NOT_STAFF', roles: [], staffId: undefined }, stored, NOW)).toEqual({ kind: 'revoke' });
    expect(verificationStep({ ...staffAccess, roles: ['Accounts'] }, stored, NOW)).toEqual({ kind: 'revoke' });
  });

  it('does nothing on an unauthenticated answer, which is not a decision about the account', () => {
    expect(verificationStep({ ...staffAccess, allowed: false, reason: 'UNAUTHENTICATED', roles: [], staffId: undefined }, stored, NOW)).toEqual({ kind: 'none' });
  });
});
