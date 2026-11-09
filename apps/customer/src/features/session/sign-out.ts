import { logEvent } from '@/lib/safe-log';

export interface SignOutDeps {
  /** Removes the session this device holds (SecureStore keys and the in-memory session). */
  clearSession: () => Promise<void>;
  /** Asks the server to end the session. Best effort: it may be offline or never answer. */
  revoke: () => Promise<unknown>;
  timeoutMs?: number;
  /** Deletes the saved trips, plans and updates (everything this phone keeps for the account). */
  wipeData: () => Promise<void>;
}

const REVOKE_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Signs this device out whatever the network does. The server is asked to revoke the session
 * first (that request needs the session cookie), then the local session and all app data are
 * deleted, each step independent of the others.
 */
export async function signOutDevice(deps: SignOutDeps) {
  try {
    await withTimeout(deps.revoke(), deps.timeoutMs ?? REVOKE_TIMEOUT_MS);
  } catch (error) {
    logEvent('session.revoke-failed', error);
  }
  try {
    await deps.clearSession();
  } catch (error) {
    logEvent('session.clear-session-failed', error);
  }
  try {
    await deps.wipeData();
  } catch (error) {
    logEvent('session.clear-failed', error);
  }
}
