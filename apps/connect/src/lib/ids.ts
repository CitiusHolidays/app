import * as Crypto from 'expo-crypto';

/** A random local id for outbox items, announcements and receipt files. */
export function localId(prefix: string) {
  return `${prefix}_${Crypto.randomUUID()}`;
}
