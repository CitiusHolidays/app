import * as SQLite from 'expo-sqlite';

import { isWrongKeyError, openDeviceStore } from './device-store';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'unlocked-this-device',
  getItemAsync: jest.fn(async () => 'a'.repeat(64)),
  setItemAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-crypto', () => ({ getRandomBytesAsync: jest.fn(async () => new Uint8Array(32)) }));

const mockFailures: Error[] = [];
jest.mock('expo-sqlite', () => ({
  deleteDatabaseAsync: jest.fn(async () => undefined),
  openDatabaseAsync: jest.fn(async () => ({
    closeAsync: async () => undefined,
    execAsync: async (sql: string) => {
      if (sql.startsWith('CREATE TABLE') && mockFailures.length) throw mockFailures.shift();
    },
    getFirstAsync: async () => ({ cipher_version: '4.6.1' }),
  })),
}));

describe('device store', () => {
  beforeEach(() => {
    mockFailures.length = 0;
    jest.mocked(SQLite.deleteDatabaseAsync).mockClear();
  });

  it('recognises only a wrong-key or not-a-database error', () => {
    expect(isWrongKeyError(new Error('Calling the execAsync function has failed → Caused by: file is not a database'))).toBe(true);
    expect(isWrongKeyError(new Error('Error code 26: SQLITE_NOTADB'))).toBe(true);
    expect(isWrongKeyError(new Error('database is locked'))).toBe(false);
    expect(isWrongKeyError(new Error('disk I/O error'))).toBe(false);
    expect(isWrongKeyError('not an error')).toBe(false);
  });

  it('deletes and recreates the database when the stored key cannot open it', async () => {
    mockFailures.push(new Error('file is not a database'));
    await expect(openDeviceStore()).resolves.toMatchObject({ encrypted: true });
    expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps the database on any other open error, so a transient failure loses nothing', async () => {
    mockFailures.push(new Error('database is locked'));
    await expect(openDeviceStore()).rejects.toThrow('database is locked');
    expect(SQLite.deleteDatabaseAsync).not.toHaveBeenCalled();
  });
});
