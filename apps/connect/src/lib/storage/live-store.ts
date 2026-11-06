import { logEvent } from '../safe-log';

import type { KeyValueStore } from './kv';

interface Entry {
  value: unknown;
}

/** In-memory mirror of the store with per-key subscriptions. */
export class LiveStore {
  private entries = new Map<string, Entry>();
  private listeners = new Map<string, Set<() => void>>();
  private loading = new Set<string>();

  constructor(private readonly store: KeyValueStore) {}

  subscribe(key: string, listener: () => void) {
    const set = this.listeners.get(key) ?? new Set();
    set.add(listener);
    this.listeners.set(key, set);
    return () => {
      set.delete(listener);
    };
  }

  snapshot(key: string) {
    return this.entries.get(key);
  }

  ensureLoaded(key: string) {
    if (this.entries.has(key) || this.loading.has(key)) return;
    this.loading.add(key);
    this.store
      .getJSON(key)
      .then((value) => {
        if (!this.entries.has(key)) this.write(key, value);
      })
      .catch((error: unknown) => {
        logEvent('store.read-failed', error);
        if (!this.entries.has(key)) this.write(key, null);
      })
      .finally(() => this.loading.delete(key));
  }

  set(key: string, value: unknown) {
    this.write(key, value);
    this.store.setJSON(key, value).catch((error: unknown) => logEvent('store.write-failed', error));
  }

  /** After sign-out cleared the store: every key reads as empty, and stays loaded. */
  reset() {
    for (const key of [...this.entries.keys()]) this.write(key, null);
  }

  private write(key: string, value: unknown) {
    this.entries.set(key, { value });
    this.notify(key);
  }

  private notify(key: string) {
    for (const listener of this.listeners.get(key) ?? []) listener();
  }
}
