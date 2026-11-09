import type { KeyValueStore } from './kv';
import { createMemoryStore } from './memory-store';

/** Web is a preview surface only: nothing is persisted, so no trip data is left in a browser. */
export async function openDeviceStore(): Promise<KeyValueStore> {
  return createMemoryStore();
}
