import { clients } from '@/lib/clients';
import { logEvent } from '@/lib/safe-log';

import { type SignInState, signInRefusal } from './sign-in-state';

/** False only in a build with no server address, where there is nothing to sign in to. */
export const canSignIn = clients !== null;

const NO_CONNECTION = 'Could not reach Citius. Check your connection and try again.';

/**
 * Signs in with a work email and password through Better Auth: `done`, or what to tell the
 * person. Never throws: a refusal and a failed request both come back as a state to show.
 */
export async function signInWithEmail(email: string, password: string): Promise<Extract<SignInState, { kind: 'done' | 'error' | 'refused' }>> {
  try {
    if (!clients) return { kind: 'error', message: NO_CONNECTION };
    const { error } = await clients.auth.signIn.email({ email, password });
    if (!error) return { kind: 'done' };
    logEvent('auth.sign-in-refused');
    return signInRefusal(error.status);
  } catch (error) {
    logEvent('auth.sign-in-failed', error);
    return { kind: 'error', message: NO_CONNECTION };
  }
}
