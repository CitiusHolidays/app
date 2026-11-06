import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { APP_SCHEME, clients } from './clients';

/**
 * The SecureStore keys `@better-auth/expo` writes, with `storagePrefix` set to the app scheme
 * (see `createAppAuthClient`). The plugin itself only clears them when `/sign-out` is called.
 */
export const SESSION_STORAGE_KEYS = [`${APP_SCHEME}_cookie`, `${APP_SCHEME}_session_data`];

/** The plugin splits large values into `<key>.<n>` or `<key>.<slot>.<n>` chunks, at most 100. */
const MAX_CHUNKS = 100;

interface DeletableStore {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
}

export async function deleteStoredSession(storage: DeletableStore) {
  for (const key of SESSION_STORAGE_KEYS) {
    await storage.deleteItemAsync(key);
    for (const prefix of [key, `${key}.0`, `${key}.1`]) {
      for (let index = 0; index < MAX_CHUNKS; index += 1) {
        const chunk = `${prefix}.${index}`;
        if (!(await storage.getItemAsync(chunk))) break;
        await storage.deleteItemAsync(chunk);
      }
    }
  }
}

interface SessionAtom {
  get: () => Record<string, unknown>;
  set: (value: Record<string, unknown>) => void;
}

/**
 * Forgets the session on this device without the server: deletes the stored cookie and session
 * cache, and empties the in-memory session so Convex drops its token at once.
 */
export async function clearLocalAuthSession() {
  if (Platform.OS !== 'web') {
    await deleteStoredSession(SecureStore);
  }
  const atom = (clients?.auth as { $store?: { atoms?: { session?: SessionAtom } } } | undefined)?.$store?.atoms?.session;
  if (atom) {
    atom.set({ ...atom.get(), data: null, error: null, isPending: false });
  }
}
