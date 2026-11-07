import type { KeyValueStore } from './kv';

/** In-memory store for tests and the web preview. Nothing is persisted. */
export function createMemoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    clear: async () => data.clear(),
    delete: async (key) => {
      data.delete(key);
    },
    encrypted: false,
    getJSON: async <T,>(key: string) => {
      const raw = data.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    },
    keys: async (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
    setJSON: async (key, value) => {
      data.set(key, JSON.stringify(value));
    },
  };
}
