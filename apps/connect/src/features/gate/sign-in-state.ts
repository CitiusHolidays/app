/**
 * `refused`: the person's mistake (missing or wrong details), so the fields shake. `error`: not
 * their mistake (no connection, a server fault). `done`: signed in; the button stays busy until
 * the app moves on, so a second tap cannot send the form again.
 */
export type SignInState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'refused'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

/** If the app has still not moved on this long after a sign-in, the form comes back. */
export const OPEN_TIMEOUT_MS = 15_000;

/** What a refused sign-in tells the person, by the HTTP status Better Auth answered with. */
export function signInRefusal(status: number): Extract<SignInState, { kind: 'error' | 'refused' }> {
  if (status === 400 || status === 401) {
    return { kind: 'refused', message: 'That email and password do not match a Citius account.' };
  }
  if (status === 403) {
    return { kind: 'error', message: 'This account cannot sign in yet. Contact HR or your manager.' };
  }
  if (status === 429) {
    return { kind: 'error', message: 'Too many attempts. Wait a minute, then try again.' };
  }
  return { kind: 'error', message: 'Citius could not sign you in just now. Try again in a minute.' };
}
