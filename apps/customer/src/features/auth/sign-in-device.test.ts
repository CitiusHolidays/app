import { SIGN_IN_DEVICE_HEADER } from '@citius/backend/customer';

import { requestEmailLink, verifyEmailLink } from './methods';
import { signInDevice } from './sign-in-device';

const mockStored = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'unlocked-this-device',
  getItemAsync: jest.fn(async (key: string) => mockStored.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStored.set(key, value);
  }),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
    jest.requireActual('crypto').createHash('sha256').update(value).digest('hex')
  ),
  getRandomBytesAsync: jest.fn(async () => Uint8Array.from({ length: 32 }, (_, i) => i * 7)),
}));

jest.mock('@/lib/clients', () => ({
  clients: {
    auth: {
      magicLink: { verify: jest.fn(async () => ({ error: null })) },
      signIn: { magicLink: jest.fn(async () => ({ error: null })) },
    },
  },
}));


const { clients } = jest.requireMock<{
  clients: { auth: { magicLink: { verify: jest.Mock }; signIn: { magicLink: jest.Mock } } };
}>('@/lib/clients');
const mockSignIn = clients.auth.signIn.magicLink;
const mockVerify = clients.auth.magicLink.verify;
type NodeHash = { createHash: (name: string) => { update: (v: string) => { digest: (e: string) => string } } };
const sha256 = (value: string): string =>
  jest.requireActual<NodeHash>('crypto').createHash('sha256').update(value).digest('hex');

beforeEach(() => {
  mockStored.clear();
  mockSignIn.mockClear();
  mockVerify.mockClear();
});

describe('sign-in device binding', () => {
  it('keeps one 32-byte secret per install and shares only its SHA-256 digest', async () => {
    const first = await signInDevice();
    const second = await signInDevice();
    expect(first.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.secret).toBe(first.secret);
    expect(first.digest).toBe(sha256(first.secret));
  });

  it('asks for a link with the digest and opens it with the secret', async () => {
    const { digest, secret } = await signInDevice();
    await requestEmailLink(' Asha@Example.test ');
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'asha@example.test', metadata: { deviceDigest: digest } });
    await verifyEmailLink('token-123');
    expect(mockVerify).toHaveBeenCalledWith({
      fetchOptions: { headers: { [SIGN_IN_DEVICE_HEADER]: secret } },
      query: { token: 'token-123' },
    });
  });
});
