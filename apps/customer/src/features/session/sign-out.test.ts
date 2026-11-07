import { deleteStoredSession, SESSION_STORAGE_KEYS } from '@/lib/auth-storage';

import { signOutDevice } from './sign-out';

jest.mock('@/lib/clients', () => ({ APP_SCHEME: 'citius', clients: null }));

function fakeSecureStore(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    deleteItemAsync: async (key: string) => {
      data.delete(key);
    },
    getItemAsync: async (key: string) => data.get(key) ?? null,
  };
}

describe('sign-out', () => {
  it('names the Expo plugin keys for this app scheme', () => {
    expect(SESSION_STORAGE_KEYS).toEqual(['citius_cookie', 'citius_session_data']);
  });

  it('deletes the stored session, including chunked values, and leaves the database key alone', async () => {
    const store = fakeSecureStore({
      'citius.dbkey': 'k'.repeat(64),
      citius_cookie: '__chunked__2:0',
      'citius_cookie.0.0': 'part-a',
      'citius_cookie.0.1': 'part-b',
      citius_session_data: '{"session":{"id":"s"}}',
      'citius_session_data.0': 'old-chunk',
    });
    await deleteStoredSession(store);
    expect([...store.data.keys()]).toEqual(['citius.dbkey']);
  });

  it('clears the local session and wipes app data even when the server cannot be reached', async () => {
    const steps: string[] = [];
    await signOutDevice({
      clearSession: async () => {
        steps.push('clear-session');
      },
      revoke: async () => {
        steps.push('revoke');
        throw new TypeError('Network request failed');
      },
      wipeData: async () => {
        steps.push('wipe');
      },
    });
    expect(steps).toEqual(['revoke', 'clear-session', 'wipe']);
  });

  it('does not wait forever for a server that never answers', async () => {
    const steps: string[] = [];
    await signOutDevice({
      clearSession: async () => {
        steps.push('clear-session');
      },
      revoke: () => new Promise(() => undefined),
      timeoutMs: 10,
      wipeData: async () => {
        steps.push('wipe');
      },
    });
    expect(steps).toEqual(['clear-session', 'wipe']);
  });

  it('still wipes app data when clearing the session fails', async () => {
    const wipe = jest.fn(async () => undefined);
    await signOutDevice({
      clearSession: async () => {
        throw new Error('keychain unavailable');
      },
      revoke: async () => undefined,
      wipeData: wipe,
    });
    expect(wipe).toHaveBeenCalled();
  });
});
