import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const SECRET_KEY = 'citius.signInDevice';
const SECRET_OPTIONS: SecureStore.SecureStoreOptions = {
  // Never restored to another phone from a backup: the secret is what makes this phone this phone.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function base64Url(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let c = 0; c < chars; c += 1) out += alphabet[(chunk >> (18 - c * 6)) & 63];
  }
  return out;
}

/**
 * The secret that ties an email sign-in link to this phone (website ADR 0020). The app sends only
 * its SHA-256 digest when it asks for a link and the secret itself when it opens the link, so a
 * link forwarded to anyone else's phone signs nobody in. One secret per install.
 */
export async function signInDevice() {
  let secret = await SecureStore.getItemAsync(SECRET_KEY, SECRET_OPTIONS);
  if (!secret) {
    secret = base64Url(await Crypto.getRandomBytesAsync(32));
    await SecureStore.setItemAsync(SECRET_KEY, secret, SECRET_OPTIONS);
  }
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, secret, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return { digest: digest.toLowerCase(), secret };
}
