/**
 * The session's own state, as one machine: whether this phone still holds a Better Auth session
 * cookie, whether the next person to sign in must be confirmed by the server, how long the server
 * has kept the app waiting, and whether a sign-out is under way. The server's answers (Convex auth
 * and `getMyPortalAccess`) stay outside; `resolveGate` combines the two.
 */

/** The saved session cookie, read again after every sign-in change and every sign-out. */
interface CookieRead {
  /** The `isAuthenticated` value this read belongs to; a different value means "read again". */
  forAuth: boolean;
  /** Bumped for each new read, so a slow, outdated read is ignored. */
  read: number;
  status: 'checking' | 'held' | 'none';
}

/**
 * `required`: someone has reached the sign-in screen since this phone last verified a tour
 * manager, so saved data stays closed until the server confirms who signed in. `unread` until the
 * stored flag has loaded.
 */
type ServerCheck = 'unread' | 'required' | 'done';

/** `stalled` once the server has kept the app waiting for SERVER_STALL_MS. */
type ServerWait = 'idle' | 'waiting' | 'stalled';

interface Shared {
  cookie: CookieRead;
  serverCheck: ServerCheck;
}

export type GateMachine = (Shared & { kind: 'active'; wait: ServerWait }) | (Shared & { kind: 'signingOut' });

export type GateEvent =
  | { isAuthenticated: boolean; type: 'authChanged' }
  | { held: boolean; read: number; type: 'cookieRead' }
  | { required: boolean; type: 'serverCheckLoaded' }
  /** The sign-in screen is showing: whoever signs in next is checked by the server first. */
  | { type: 'signInShown' }
  /** A tour manager's verification has been saved. */
  | { type: 'verified' }
  | { type: 'serverWaiting'; waiting: boolean }
  | { type: 'stallTimerFired' }
  | { type: 'retry' }
  | { type: 'signOutStarted' }
  | { type: 'signOutFinished' };

/** How long the gate waits for the server before saying so (and before using the offline rules). */
export const SERVER_STALL_MS = 8_000;

export function initialGateMachine(isAuthenticated: boolean): GateMachine {
  return {
    cookie: { forAuth: isAuthenticated, read: 0, status: 'checking' },
    kind: 'active',
    serverCheck: 'unread',
    wait: 'idle',
  };
}

const readAgain = (cookie: CookieRead, forAuth = cookie.forAuth): CookieRead => ({
  forAuth,
  read: cookie.read + 1,
  status: 'checking',
});

function withWait(state: GateMachine, wait: ServerWait): GateMachine {
  return state.kind === 'active' && state.wait !== wait ? { ...state, wait } : state;
}

/** Every transition returns the same object when nothing changes, so React skips the render. */
export function gateMachine(state: GateMachine, event: GateEvent): GateMachine {
  switch (event.type) {
    case 'authChanged':
      return state.cookie.forAuth === event.isAuthenticated
        ? state
        : { ...state, cookie: readAgain(state.cookie, event.isAuthenticated) };
    case 'cookieRead':
      return event.read === state.cookie.read && state.cookie.status === 'checking'
        ? { ...state, cookie: { ...state.cookie, status: event.held ? 'held' : 'none' } }
        : state;
    case 'serverCheckLoaded':
      return state.serverCheck === 'unread' ? { ...state, serverCheck: event.required ? 'required' : 'done' } : state;
    case 'signInShown':
      return state.serverCheck === 'done' ? { ...state, serverCheck: 'required' } : state;
    case 'verified':
      return state.serverCheck === 'done' ? state : { ...state, serverCheck: 'done' };
    case 'serverWaiting':
      if (!event.waiting) {
        return withWait(state, 'idle');
      }
      return state.kind === 'active' && state.wait === 'idle' ? withWait(state, 'waiting') : state;
    case 'stallTimerFired':
      return state.kind === 'active' && state.wait === 'waiting' ? withWait(state, 'stalled') : state;
    case 'retry':
      return state.kind === 'active' && state.wait === 'stalled' ? withWait(state, 'waiting') : state;
    case 'signOutStarted':
      return state.kind === 'signingOut' ? state : { cookie: state.cookie, kind: 'signingOut', serverCheck: state.serverCheck };
    case 'signOutFinished':
      // The session cookie has just been deleted: read it again before deciding anything.
      return { cookie: readAgain(state.cookie), kind: 'active', serverCheck: state.serverCheck, wait: 'idle' };
  }
}
