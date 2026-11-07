import { type GateInput, resolveGate, sessionRejectedByServer } from './gate';

const base: GateInput = {
  hasCachedSession: true,
  isAuthenticated: false,
  isLoading: true,
  online: true,
  sessionRejected: false,
  stalled: false,
};

describe('customer gate', () => {
  it('waits while the stored session is read', () => {
    expect(resolveGate({ ...base, hasCachedSession: null })).toEqual({ kind: 'loading' });
  });

  it('signs in when Convex has the token', () => {
    expect(resolveGate({ ...base, isAuthenticated: true, isLoading: false })).toEqual({ kind: 'signedIn', offline: false });
  });

  it('shows sign-in when no session is stored', () => {
    expect(resolveGate({ ...base, hasCachedSession: false, isLoading: false })).toEqual({ kind: 'signedOut' });
  });

  it('opens saved trips offline or on a stalled connection', () => {
    expect(resolveGate({ ...base, online: false })).toEqual({ kind: 'signedIn', offline: true });
    expect(resolveGate({ ...base, stalled: true })).toEqual({ kind: 'signedIn', offline: true });
  });

  it('waits for the server while it may still answer', () => {
    expect(resolveGate({ ...base, isLoading: false })).toEqual({ kind: 'loading' });
  });

  it('signs out only when the server rejects the session', () => {
    expect(resolveGate({ ...base, isLoading: false, sessionRejected: true })).toEqual({ kind: 'signedOut' });
    expect(resolveGate({ ...base, online: false, sessionRejected: true })).toEqual({ kind: 'signedIn', offline: true });
  });
});

describe('session rejection', () => {
  it('counts an empty answer or 401/403 as rejected, a network error as not', () => {
    expect(sessionRejectedByServer({ data: null, error: null, isPending: false })).toBe(true);
    expect(sessionRejectedByServer({ data: null, error: { status: 401 }, isPending: false })).toBe(true);
    expect(sessionRejectedByServer({ data: null, error: new TypeError('Network'), isPending: false })).toBe(false);
    expect(sessionRejectedByServer({ data: {}, error: null, isPending: false })).toBe(false);
  });
});
