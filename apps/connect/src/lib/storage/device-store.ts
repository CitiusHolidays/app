import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import type { KeyValueStore } from './kv';

const DATABASE_NAME = 'connect.db';
const KEY_NAME = 'citiusconnect.dbkey';
const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  // Not restored to another device from a backup; readable only while the phone is unlocked.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** The binary has no SQLCipher, so nothing may be written: the app falls back to memory only. */
export class EncryptionUnavailableError extends Error {
  constructor() {
    super('Encrypted storage is not available in this build');
    this.name = 'EncryptionUnavailableError';
  }
}

async function databaseKey() {
  const existing = await SecureStore.getItemAsync(KEY_NAME, KEY_OPTIONS);
  if (existing) {
    return existing;
  }
  const bytes = await Crypto.getRandomBytesAsync(32);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, hex, KEY_OPTIONS);
  return hex;
}

async function openKeyed() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // SQLite ignores PRAGMA key without SQLCipher and would store plain text, so check first.
  const cipher = await db.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) {
    await db.closeAsync();
    throw new EncryptionUnavailableError();
  }
  const key = await databaseKey();
  if (!/^[0-9a-f]{64}$/.test(key)) {
    await db.closeAsync();
    throw new Error('Stored database key is malformed');
  }
  await db.execAsync(`PRAGMA key = "x'${key}'"`);
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)'
  );
  return db;
}

/**
 * Opens the encrypted store. If the database cannot be read with the stored key (for example the
 * key was removed), the cache is deleted and recreated: it only holds data the server can resend,
 * plus the expense outbox, whose receipt files live separately.
 */
export async function openDeviceStore(): Promise<KeyValueStore> {
  let db: SQLite.SQLiteDatabase;
  try {
    db = await openKeyed();
  } catch (error) {
    if (error instanceof EncryptionUnavailableError) {
      throw error;
    }
    await SQLite.deleteDatabaseAsync(DATABASE_NAME).catch(() => undefined);
    db = await openKeyed();
  }
  return {
    clear: async () => {
      await db.runAsync('DELETE FROM kv');
    },
    delete: async (key) => {
      await db.runAsync('DELETE FROM kv WHERE key = ?', key);
    },
    encrypted: true,
    getJSON: async <T,>(key: string) => {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
      return row ? (JSON.parse(row.value) as T) : null;
    },
    keys: async (prefix) => {
      const rows = await db.getAllAsync<{ key: string }>(
        "SELECT key FROM kv WHERE substr(key, 1, length(?)) = ?",
        prefix,
        prefix
      );
      return rows.map((row) => row.key);
    },
    setJSON: async (key, value) => {
      await db.runAsync(
        'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        key,
        JSON.stringify(value),
        Date.now()
      );
    },
  };
}
