import { afterSignIn, type AfterSignInInput, currentReturnTo, RETURN_TO_TTL_MS, returnToFor } from './after-sign-in';

const NOW = Date.UTC(2026, 10, 9, 10);

const base: AfterSignInInput = {
  canGoBack: false,
  link: { kind: 'opened' },
  pendingInvite: null,
  returnTo: null,
  signedIn: true,
};

describe('return note', () => {
  it('is current until it expires', () => {
    const note = returnToFor('/delete-account', NOW);
    expect(currentReturnTo(note, NOW + RETURN_TO_TTL_MS - 1)).toBe('/delete-account');
    expect(currentReturnTo(note, NOW + RETURN_TO_TTL_MS)).toBeNull();
  });

  it('ignores what older builds saved and anything unexpected', () => {
    expect(currentReturnTo('/delete-account', NOW)).toBeNull();
    expect(currentReturnTo({ path: '/somewhere', until: NOW + 1 }, NOW)).toBeNull();
    expect(currentReturnTo(null, NOW)).toBeNull();
  });
});

describe('after sign-in', () => {
  it('waits while signed out or while the link is still opening or failed', () => {
    expect(afterSignIn({ ...base, signedIn: false })).toEqual({ kind: 'stay' });
    expect(afterSignIn({ ...base, link: { kind: 'opening' } })).toEqual({ kind: 'stay' });
    expect(afterSignIn({ ...base, link: { kind: 'failed', reason: 'network' } })).toEqual({ kind: 'stay' });
  });

  it('returns to the screen that asked for the link, ahead of a waiting invite', () => {
    expect(afterSignIn({ ...base, pendingInvite: 'tok', returnTo: '/delete-account' })).toEqual({ kind: 'return', path: '/delete-account' });
  });

  it('never lets a return note steer a sign-in that did not come from a link', () => {
    expect(afterSignIn({ ...base, link: { kind: 'none' }, returnTo: '/delete-account' })).toEqual({ kind: 'home' });
  });

  it('opens a waiting invite', () => {
    expect(afterSignIn({ ...base, pendingInvite: 'tok' })).toEqual({ kind: 'invite', token: 'tok' });
    expect(afterSignIn({ ...base, link: { kind: 'none' }, pendingInvite: 'tok' })).toEqual({ kind: 'invite', token: 'tok' });
  });

  it('goes back when a link arrives on top of a screen, home otherwise', () => {
    expect(afterSignIn({ ...base, canGoBack: true })).toEqual({ kind: 'back' });
    expect(afterSignIn(base)).toEqual({ kind: 'home' });
    expect(afterSignIn({ ...base, canGoBack: true, link: { kind: 'none' } })).toEqual({ kind: 'home' });
  });
});
