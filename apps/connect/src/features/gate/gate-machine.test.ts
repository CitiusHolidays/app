import { type GateEvent, type GateMachine, gateMachine, initialGateMachine } from './gate-machine';

const run = (events: GateEvent[], start: GateMachine = initialGateMachine(true)) => events.reduce(gateMachine, start);

describe('gateMachine', () => {
  it('reads the saved session again after a sign-in change and ignores an outdated read', () => {
    const changed = run([{ isAuthenticated: false, type: 'authChanged' }]);
    expect(changed.cookie).toEqual({ forAuth: false, read: 1, status: 'checking' });
    // The read started before the change answers late: it no longer counts.
    expect(gateMachine(changed, { held: true, read: 0, type: 'cookieRead' }).cookie.status).toBe('checking');
    expect(gateMachine(changed, { held: false, read: 1, type: 'cookieRead' }).cookie.status).toBe('none');
  });

  it('requires a server check once the sign-in screen shows, until a tour manager is verified', () => {
    const shown = run([{ required: false, type: 'serverCheckLoaded' }, { type: 'signInShown' }]);
    expect(shown.serverCheck).toBe('required');
    expect(gateMachine(shown, { type: 'verified' }).serverCheck).toBe('done');
    // The stored flag is read once; a later read does not undo a transition.
    expect(gateMachine(shown, { required: false, type: 'serverCheckLoaded' }).serverCheck).toBe('required');
  });

  it('stalls a server wait only while still waiting, and waits again on retry', () => {
    const waiting = run([{ type: 'serverWaiting', waiting: true }]);
    const stalled = gateMachine(waiting, { type: 'stallTimerFired' });
    expect(stalled).toMatchObject({ wait: 'stalled' });
    expect(gateMachine(stalled, { type: 'retry' })).toMatchObject({ wait: 'waiting' });
    // An answer that arrives just before the timer leaves nothing to stall.
    const answered = gateMachine(waiting, { type: 'serverWaiting', waiting: false });
    expect(gateMachine(answered, { type: 'stallTimerFired' })).toMatchObject({ wait: 'idle' });
  });

  it('reads the deleted session cookie again when a sign-out finishes', () => {
    const held = run([{ held: true, read: 0, type: 'cookieRead' }]);
    const signingOut = gateMachine(held, { type: 'signOutStarted' });
    expect(signingOut.kind).toBe('signingOut');
    // A server wait during the sign-out is not a stall of anything the user can retry.
    expect(gateMachine(signingOut, { type: 'serverWaiting', waiting: true })).toBe(signingOut);
    expect(gateMachine(signingOut, { type: 'signOutFinished' })).toMatchObject({
      cookie: { read: 1, status: 'checking' },
      kind: 'active',
      wait: 'idle',
    });
  });

  it('returns the same state when an event changes nothing', () => {
    const state = initialGateMachine(true);
    expect(gateMachine(state, { isAuthenticated: true, type: 'authChanged' })).toBe(state);
    expect(gateMachine(state, { type: 'retry' })).toBe(state);
  });
});
