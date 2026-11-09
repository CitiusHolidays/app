export interface AuthSessionState {
  data: unknown;
  error: unknown;
  isPending: boolean;
}

/**
 * True only when the server itself said there is no valid session: an empty answer, or 401/403.
 * A network failure, a timeout or a 5xx is not a rejection: the traveller keeps their saved trips.
 */
export function sessionRejectedByServer(state: AuthSessionState) {
  if (state.isPending || state.data) {
    return false;
  }
  if (!state.error) {
    return true;
  }
  const status = (state.error as { status?: unknown }).status;
  return status === 401 || status === 403;
}

export type Gate = { kind: 'loading' } | { kind: 'signedOut' } | { kind: 'signedIn'; offline: boolean };

export interface GateInput {
  /** The session cookie is on this phone (SecureStore); null while it is being read. */
  hasCachedSession: boolean | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  online: boolean;
  sessionRejected: boolean;
  /** The server has not answered for a while (a hanging 3G connection never errors). */
  stalled: boolean;
  /** The last gate was signed in. A new session (an email link opened while signed in) briefly
   * reads as unauthenticated while Convex swaps its token; the app must not unmount meanwhile. */
  wasSignedIn: boolean;
}

/**
 * The customer app is open to anyone signed in. A phone that holds a session opens its saved
 * trips at once when the server is slow or out of reach (on a bus, abroad without data); only a
 * server that says the session is gone signs it out. `offline` is the phone's connection, so
 * screens show saved data and say so whenever it drops, signed in or not.
 */
export function resolveGate(input: GateInput): Gate {
  const rejected = input.online && input.sessionRejected && !input.isLoading && !input.isAuthenticated;
  const signedIn: Gate = { kind: 'signedIn', offline: !input.online };
  if (input.isAuthenticated) return signedIn;
  if (input.wasSignedIn && !rejected && input.hasCachedSession !== false) return signedIn;
  if (input.hasCachedSession === null) return { kind: 'loading' };
  if (!input.hasCachedSession) return input.isLoading ? { kind: 'loading' } : { kind: 'signedOut' };
  if (!input.online) return signedIn;
  if (rejected) return { kind: 'signedOut' };
  return input.stalled ? { kind: 'signedIn', offline: true } : { kind: 'loading' };
}
