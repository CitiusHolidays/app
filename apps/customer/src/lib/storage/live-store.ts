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
  /** Bumped by every wipe, so work that started before it can tell it is stale. */
  private epoch = 0;

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
    const epoch = this.epoch;
    this.store
      .getJSON(key)
      .then((value) => {
        // A wipe since the read started means the value belongs to data that was deleted.
        if (!this.entries.has(key)) this.write(key, epoch === this.epoch ? value : null);
      })
      .catch((error: unknown) => {
        logEvent('store.read-failed', error);
        if (!this.entries.has(key)) this.write(key, null);
      })
      .finally(() => this.loading.delete(key));
  }

  /** Updates the key at once; the returned promise settles when the value is on disk. */
  set(key: string, value: unknown): Promise<void> {
    this.write(key, value);
    return this.store.setJSON(key, value).catch((error: unknown) => logEvent('store.write-failed', error));
  }

  /**
   * Returns a check that stays true until the next wipe. Async work (a refresh, an outbox run)
   * takes one before it starts and drops its result if a wipe happened in between.
   */
  fence() {
    const epoch = this.epoch;
    return () => epoch === this.epoch;
  }

  /**
   * Deletes everything on disk; every key then reads as empty, and stays loaded. Keys in `keep`
   * (read from disk if no screen has loaded them) are written back afterwards.
   */
  async wipe(keep: readonly string[] = []) {
    const kept = await Promise.all(
      keep.map(async (key) => [key, this.entries.has(key) ? this.entries.get(key)?.value : await this.readKept(key)] as const)
    );
    this.epoch += 1;
    this.clearEntries();
    await this.store.clear();
    this.clearEntries();
    await Promise.all(kept.map(([key, value]) => (value === null || value === undefined ? undefined : this.set(key, value))));
  }

  private async readKept(key: string) {
    try {
      return await this.store.getJSON(key);
    } catch (error) {
      logEvent('store.read-failed', error);
      return null;
    }
  }

  private clearEntries() {
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
