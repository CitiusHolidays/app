import { act, fireEvent, screen } from '@testing-library/react-native';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { AppState, type AppStateStatus } from 'react-native';

import PassportViewer from '@/app/passport/[id]';
import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';
import { renderWithTheme } from '@/test/render';

let mockStore: KeyValueStore & { writes: string[] };
const mockSession = { online: true };
const mockAction = jest.fn();

const mockPreventCapture = jest.fn();
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: (key?: string) => mockPreventCapture(key) }));
jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));
jest.mock('@/features/gate/session', () => ({
  useStaffSession: () => ({ gate: { kind: 'staff', offline: false, staff: { staffId: 'staff_1' } }, online: mockSession.online }),
}));
const mockConvex = { action: (...args: unknown[]) => mockAction(...args) };
jest.mock('convex/react', () => ({ useConvex: () => mockConvex }));
jest.mock('@/features/trips/trips-context', () => ({
  useTrips: () => ({ pack: { roster: [{ id: 't_2', name: 'Asha Example' }] } }),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => ({ id: 't_2' }) }));
// Any attempt to put the scan in a file would go through expo-file-system.
const mockFileWrites = jest.fn();
jest.mock('expo-file-system', () => ({
  Directory: jest.fn(() => mockFileWrites('directory')),
  File: jest.fn(() => mockFileWrites('file')),
  Paths: { cache: 'cache', document: 'document' },
}));

const SCAN = new TextEncoder().encode('not really a jpeg, but bytes all the same');

function spiedStore() {
  const inner: KeyValueStore = jest.requireActual('@/lib/storage/memory-store').createMemoryStore();
  const writes: string[] = [];
  return {
    ...inner,
    setJSON: async (key: string, value: unknown) => {
      writes.push(`${key}=${JSON.stringify(value)}`);
      await inner.setJSON(key, value);
    },
    writes,
  };
}

async function renderViewer() {
  return renderWithTheme(
    <AppStoreProvider fallback={null}>
      <PassportViewer />
    </AppStoreProvider>
  );
}

describe('passport viewer', () => {
  let appStateListener: ((state: AppStateStatus) => void) | null;
  beforeEach(() => {
    mockStore = spiedStore();
    mockSession.online = true;
    mockAction.mockReset();
    mockAction.mockResolvedValue({ bytes: SCAN.buffer, fileName: 'passport.jpg', mimeType: 'image/jpeg' });
    mockFileWrites.mockReset();
    appStateListener = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows the scan from memory and writes nothing to the store, the outbox or a file', async () => {
    await renderViewer();
    expect(await screen.findByLabelText('Passport scan of Asha Example')).toBeOnTheScreen();
    expect(getFunctionName(mockAction.mock.calls[0]?.[0])).toBe('crm/fieldPassportActions:getFieldPassportFile');
    expect(mockAction.mock.calls[0]?.[1]).toEqual({ travellerId: 't_2' });
    expect(mockStore.writes).toEqual([]);
    expect(await mockStore.keys('')).toEqual([]);
    expect(mockFileWrites).not.toHaveBeenCalled();
  });

  it('forgets the scan as soon as the app goes to the background', async () => {
    await renderViewer();
    expect(await screen.findByLabelText('Passport scan of Asha Example')).toBeOnTheScreen();
    await act(async () => appStateListener?.('inactive'));
    expect(screen.queryByLabelText('Passport scan of Asha Example')).not.toBeOnTheScreen();
    expect(screen.getByText(/hidden when you left the app/)).toBeOnTheScreen();

    // Opening it again is a new, audited read.
    await fireEvent.press(screen.getByRole('button', { name: 'Show again' }));
    expect(await screen.findByLabelText('Passport scan of Asha Example')).toBeOnTheScreen();
    expect(mockAction).toHaveBeenCalledTimes(2);
    expect(mockStore.writes).toEqual([]);
  });

  it('is online only: offline it says so and asks the server for nothing', async () => {
    mockSession.online = false;
    await renderViewer();
    expect(await screen.findByText(/Passports open only online/)).toBeOnTheScreen();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('explains a refusal outside the trip window', async () => {
    mockAction.mockRejectedValue(new ConvexError('Passports open in the app from the day before the trip starts until the day after it ends'));
    await renderViewer();
    expect(await screen.findByText(/from the day before the trip starts/)).toBeOnTheScreen();
  });

  it('does not keep a PDF it cannot show', async () => {
    mockAction.mockResolvedValue({ bytes: SCAN.buffer, fileName: 'passport.pdf', mimeType: 'application/pdf' });
    await renderViewer();
    expect(await screen.findByText(/is a PDF/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Passport scan of Asha Example')).not.toBeOnTheScreen();
    expect(mockFileWrites).not.toHaveBeenCalled();
    expect(mockStore.writes).toEqual([]);
  });

  it('blocks screenshots and recordings while a passport is open', async () => {
    await renderViewer();
    expect(mockPreventCapture).toHaveBeenCalledWith('passport');
  });
});
