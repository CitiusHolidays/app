/**
 * The app's only local store. On iOS and Android it is an SQLCipher database whose key lives in
 * SecureStore (see device-store.ts). Everything that leaves memory goes through here.
 */
export interface KeyValueStore {
  clear: () => Promise<void>;
  /** True only when the store is encrypted at rest. The web preview store is not. */
  encrypted: boolean;
  getJSON: <T>(key: string) => Promise<T | null>;
  setJSON: (key: string, value: unknown) => Promise<void>;
}
