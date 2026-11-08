import { verifyEmailLink } from './methods';

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

/** The server's rule: each link works once. */
const mockUsed = new Set<string>();
const mockVerify = jest.fn(async ({ query }: { query: { token: string } }) => {
  if (mockUsed.has(query.token)) return { error: { status: 401 } };
  mockUsed.add(query.token);
  return { error: null };
});
jest.mock('@/lib/clients', () => ({ clients: { auth: { magicLink: { verify: (request: { query: { token: string } }) => mockVerify(request) } } } }));

type NodeHash = { createHash: (name: string) => { update: (v: string) => { digest: (e: string) => string } } };
const sha256 = (value: string): string =>
  jest.requireActual<NodeHash>('crypto').createHash('sha256').update(value).digest('hex');

beforeEach(() => {
  mockStored.clear();
  mockUsed.clear();
  mockVerify.mockClear();
});

describe('opening an email sign-in link', () => {
  it('signs in on the first arrival of the link', async () => {
    await expect(verifyEmailLink('link-one')).resolves.toEqual({ ok: true });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('treats the same link arriving again while signed in as done, not as "already used"', async () => {
    await verifyEmailLink('link-one');
    // Android reopening the app from Recents, or a second tap on the website's button.
    await expect(verifyEmailLink('link-one', { signedIn: true })).resolves.toEqual({ ok: true });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('shares one request when the link arrives twice at the same moment', async () => {
    const [first, second] = await Promise.all([verifyEmailLink('link-one'), verifyEmailLink('link-one')]);
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('still refuses a mockUsed link once signed out, and any link this phone never opened', async () => {
    await verifyEmailLink('link-one');
    await expect(verifyEmailLink('link-one', { signedIn: false })).resolves.toEqual({ ok: false, reason: 'refused' });
    mockUsed.add('someone-elses-link');
    await expect(verifyEmailLink('someone-elses-link', { signedIn: true })).resolves.toEqual({ ok: false, reason: 'refused' });
  });

  it('keeps digests of opened links, never the links themselves', async () => {
    await verifyEmailLink('link-one');
    const saved = [...mockStored.values()].join(' ');
    expect(saved).not.toContain('link-one');
    expect(saved).toContain(sha256('link-one'));
  });
});
