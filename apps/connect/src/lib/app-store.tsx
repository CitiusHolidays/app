import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from 'react';

import { openDeviceStore } from './storage/device-store';
import type { KeyValueStore } from './storage/kv';
import { LiveStore } from './storage/live-store';
import { createMemoryStore } from './storage/memory-store';
import { logEvent } from './safe-log';

interface AppStoreValue {
  live: LiveStore;
  /** False when nothing survives a restart (no SQLCipher in this build, or the web preview). */
  persistent: boolean;
  store: KeyValueStore;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [value, setValue] = useState<AppStoreValue | null>(null);
  useEffect(() => {
    let active = true;
    openDeviceStore()
      .then((store) => {
        if (active) setValue({ live: new LiveStore(store), persistent: store.encrypted, store });
      })
      .catch((error: unknown) => {
        // Fail closed: without encryption nothing is written to disk.
        logEvent('store.open-failed', error);
        const store = createMemoryStore();
        if (active) setValue({ live: new LiveStore(store), persistent: false, store });
      });
    return () => {
      active = false;
    };
  }, []);
  if (!value) {
    return fallback;
  }
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) {
    throw new Error('useAppStore needs AppStoreProvider');
  }
  return value;
}

/**
 * A JSON value in the store, shared live between every screen that reads the same key and
 * written through to the encrypted store on each change. `loaded` is false until the first read.
 */
export function useStoredValue<T>(key: string | null, initial: T) {
  const { live } = useAppStore();
  const snapshot = useSyncExternalStore(
    (listener) => (key ? live.subscribe(key, listener) : () => undefined),
    () => (key ? live.snapshot(key) : undefined)
  );
  useEffect(() => {
    if (key) live.ensureLoaded(key);
  }, [key, live]);
  const loaded = snapshot !== undefined;
  const value = (loaded && snapshot.value !== null ? snapshot.value : initial) as T;
  const update = (next: T | ((previous: T) => T)) => {
    if (!key) return;
    const current = live.snapshot(key);
    const base = (current && current.value !== null ? current.value : initial) as T;
    const resolved = typeof next === 'function' ? (next as (previous: T) => T)(base) : next;
    live.set(key, resolved);
  };
  return [value, update, loaded] as const;
}
