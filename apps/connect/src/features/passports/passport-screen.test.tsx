import { act, fireEvent, screen } from '@testing-library/react-native';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { AppState, type AppStateStatus } from 'react-native';

import PassportViewer from '@/app/passport/[id]';
import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';
import { fakeFileSystem } from '@/test/fake-file-system';
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
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { back: () => mockBack() }, useLocalSearchParams: () => ({ id: 't_2' }) }));
// Any attempt to put the scan in a file goes through expo-file-system; this one remembers it all.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-file-system', () => require('@/test/fake-file-system').fakeFileSystem.module);
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }));
// The native PDF view, as a plain view that records what it was given.
const mockPdfProps = jest.fn();
jest.mock('react-native-pdf', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockPdfProps(props);
      return createElement(View, { testID: 'native-pdf' });
    },
  };
});

const VIEW_DIR = 'file:///app/Library/Caches/passport-view';
const SCAN = new TextEncoder().encode('not really a jpeg, but bytes all the same');
const PDF = new TextEncoder().encode('%PDF-1.7 not really a passport, but bytes all the same');

function lastPdfProps() {
  return mockPdfProps.mock.calls.at(-1)?.[0] as {
    enableTextSelection?: boolean;
    onError?: (error: Error) => void;
    onPageChanged?: (page: number, pages: number) => void;
    onPressLink?: (url: string) => void;
    source: { cache?: boolean; uri: string };
    trustAllCerts?: boolean;
  };
}

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
    fakeFileSystem.reset();
    mockPdfProps.mockReset();
    mockBack.mockReset();
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
    expect(mockAction.mock.calls[0]?.[1]).toEqual({ openId: expect.any(String), travellerId: 't_2', variant: 'preview' });
    expect(mockStore.writes).toEqual([]);
    expect(await mockStore.keys('')).toEqual([]);
    expect(fakeFileSystem.log).toEqual([]);
    expect(mockPdfProps).not.toHaveBeenCalled();
  });

  it('shows a small preview at once, then fades to the full scan read in the same open', async () => {
    const PREVIEW = new TextEncoder().encode('small preview bytes');
    mockAction.mockImplementation(async (_ref: unknown, args: { variant?: string }) =>
      args.variant === 'preview'
        ? { bytes: PREVIEW.buffer, fileName: 'passport-preview.jpg', fullMimeType: 'image/jpeg', height: 900, mimeType: 'image/jpeg', variant: 'preview', width: 675 }
        : { bytes: SCAN.buffer, fileName: 'passport.jpg', height: 4032, mimeType: 'image/jpeg', variant: 'full', width: 3024 }
    );
    await renderViewer();
    expect(await screen.findByLabelText('Passport scan of Asha Example')).toBeOnTheScreen();
    await act(async () => undefined);
    const calls = mockAction.mock.calls.map(([, args]) => args as { openId: string; variant: string });
    expect(calls.map((call) => call.variant)).toEqual(['preview', 'full']);
    expect(calls[0]?.openId).toBe(calls[1]?.openId);
    expect(screen.queryByText('Loading full quality…')).not.toBeOnTheScreen();
    expect(mockStore.writes).toEqual([]);
    expect(fakeFileSystem.log).toEqual([]);
  });

  it('keeps the preview and offers a retry when the full scan cannot be loaded', async () => {
    const PREVIEW = new TextEncoder().encode('small preview bytes');
    mockAction.mockImplementation(async (_ref: unknown, args: { variant?: string }) => {
      if (args.variant === 'preview') {
        return { bytes: PREVIEW.buffer, fileName: 'p.jpg', fullMimeType: 'image/jpeg', height: 900, mimeType: 'image/jpeg', variant: 'preview', width: 675 };
      }
      throw new Error('network lost');
    });
    await renderViewer();
    expect(await screen.findByText(/Showing a lower-quality copy/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Passport scan of Asha Example')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try full quality' })).toBeOnTheScreen();
  });

  it('keeps the preview too when the full read answers without a scan', async () => {
    const PREVIEW = new TextEncoder().encode('small preview bytes');
    mockAction.mockImplementation(async (_ref: unknown, args: { variant?: string }) =>
      args.variant === 'preview'
        ? { bytes: PREVIEW.buffer, fileName: 'p.jpg', fullMimeType: 'image/jpeg', height: 900, mimeType: 'image/jpeg', variant: 'preview', width: 675 }
        : { variant: 'none' }
    );
    await renderViewer();
    expect(await screen.findByText(/Showing a lower-quality copy/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Passport scan of Asha Example')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try full quality' })).toBeOnTheScreen();
  });

  it('reads a PDF in full when the server has no preview for it, in the same open', async () => {
    mockAction.mockImplementation(async (_ref: unknown, args: { variant?: string }) =>
      args.variant === 'preview' ? { variant: 'none' } : { bytes: PDF.buffer, fileName: 'passport.pdf', mimeType: 'application/pdf', variant: 'full' }
    );
    await renderViewer();
    expect(await screen.findByTestId('native-pdf')).toBeOnTheScreen();
    const calls = mockAction.mock.calls.map(([, args]) => args as { openId: string; variant: string });
    expect(calls.map((call) => call.variant)).toEqual(['preview', 'full']);
    expect(calls[0]?.openId).toBe(calls[1]?.openId);
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

  it('shows a PDF from one private cache file, with no library cache or network trust', async () => {
    mockAction.mockResolvedValue({ bytes: PDF.buffer, fileName: 'passport.pdf', mimeType: 'application/pdf' });
    await renderViewer();
    expect(await screen.findByLabelText('Passport scan of Asha Example')).toBeOnTheScreen();
    expect(screen.getByTestId('native-pdf')).toBeOnTheScreen();
    const props = lastPdfProps();
    // The only file written is a randomly named one in the cache (left out of phone backups).
    expect(props.source.uri).toMatch(new RegExp(`^${VIEW_DIR}/[0-9a-f-]{36}\\.pdf$`));
    expect([...fakeFileSystem.files.keys()]).toEqual([props.source.uri]);
    expect(fakeFileSystem.files.get(props.source.uri)).toEqual(PDF);
    expect(fakeFileSystem.log.filter((entry) => !entry.startsWith('mkdir'))).toEqual([`create ${props.source.uri}`, `write ${props.source.uri}`]);
    expect(props.source.cache).toBe(false);
    expect(props.trustAllCerts).toBe(false);
    // Nothing on a passport can be copied out or followed.
    expect(props.enableTextSelection).toBe(false);
    expect(props.onPressLink).toEqual(expect.any(Function));
    expect(mockStore.writes).toEqual([]);
    expect(await mockStore.keys('')).toEqual([]);
  });

  it('shows the page count as the tour manager swipes', async () => {
    mockAction.mockResolvedValue({ bytes: PDF.buffer, fileName: 'passport.pdf', mimeType: 'application/pdf' });
    await renderViewer();
    expect(await screen.findByTestId('native-pdf')).toBeOnTheScreen();
    await act(async () => lastPdfProps().onPageChanged?.(2, 3));
    expect(screen.getByText('Page 2 of 3')).toBeOnTheScreen();
  });

  it('deletes the PDF file when the viewer closes', async () => {
    mockAction.mockResolvedValue({ bytes: PDF.buffer, fileName: 'passport.pdf', mimeType: 'application/pdf' });
    const view = await renderViewer();
    expect(await screen.findByTestId('native-pdf')).toBeOnTheScreen();
    const uri = lastPdfProps().source.uri;
    expect(fakeFileSystem.files.has(uri)).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Close passport' }));
    expect(mockBack).toHaveBeenCalled();
    await view.unmount();
    expect(fakeFileSystem.files.size).toBe(0);
    expect(fakeFileSystem.log).toContain(`delete ${uri}`);
  });

  it('deletes the PDF file as soon as the app goes to the background', async () => {
    mockAction.mockResolvedValue({ bytes: PDF.buffer, fileName: 'passport.pdf', mimeType: 'application/pdf' });
    await renderViewer();
    expect(await screen.findByTestId('native-pdf')).toBeOnTheScreen();
    await act(async () => appStateListener?.('background'));
    expect(fakeFileSystem.files.size).toBe(0);
    expect(screen.queryByTestId('native-pdf')).not.toBeOnTheScreen();
    expect(screen.getByText(/hidden when you left the app/)).toBeOnTheScreen();

    // Showing it again is a new, audited read into a new file.
    await fireEvent.press(screen.getByRole('button', { name: 'Show again' }));
    expect(await screen.findByTestId('native-pdf')).toBeOnTheScreen();
    expect(mockAction).toHaveBeenCalledTimes(2);
    expect(fakeFileSystem.files.size).toBe(1);
  });

  it('deletes the PDF file and explains when the PDF cannot be read', async () => {
    mockAction.mockResolvedValue({ bytes: PDF.buffer, fileName: 'passport.pdf', mimeType: 'application/pdf' });
    await renderViewer();
    expect(await screen.findByTestId('native-pdf')).toBeOnTheScreen();
    await act(async () => lastPdfProps().onError?.(new Error('corrupt')));
    expect(screen.getByText(/could not be opened/)).toBeOnTheScreen();
    expect(fakeFileSystem.files.size).toBe(0);
  });

  it('does not keep a file of a type it cannot show', async () => {
    mockAction.mockResolvedValue({ bytes: SCAN.buffer, fileName: 'passport.tiff', mimeType: 'image/tiff' });
    await renderViewer();
    expect(await screen.findByText(/file type the app cannot show/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Passport scan of Asha Example')).not.toBeOnTheScreen();
    expect(fakeFileSystem.log).toEqual([]);
    expect(mockStore.writes).toEqual([]);
  });

  it("titles the viewer with the traveller's name and closes from the image view too", async () => {
    await renderViewer();
    expect(await screen.findByLabelText('Passport scan of Asha Example')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: /^Asha Example/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close passport' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('blocks screenshots and recordings while a passport is open', async () => {
    await renderViewer();
    expect(mockPreventCapture).toHaveBeenCalledWith('passport');
  });
});
