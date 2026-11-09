import { staffTheme, ThemeProvider } from '@citius/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { FieldPassports } from '@citius/backend';

import TripPackScreen from '@/app/(app)/trip';
import { batches, commandCenter, jobCard, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { renderWithTheme } from '@/test/render';

const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers });
const mockParams: { view?: string } = {};
const mockParamListeners = new Set<() => void>();
const mockSetParams = jest.fn((next: { view?: string }) => {
  Object.assign(mockParams, next);
  mockParamListeners.forEach((listener) => listener());
});
const mockRefreshPack = jest.fn(async () => undefined);
type MockTrips = Record<string, unknown> & { packStatus: { kind: string; pack?: unknown } };
const readyTrips = (): MockTrips => ({
  canRefresh: true,
  pack: mockPack,
  packLoading: false,
  packProblem: null,
  packStatus: { kind: 'ready', pack: mockPack },
  refreshPack: mockRefreshPack,
  selected: jobCard,
  tripsStatus: { kind: 'ready' },
});
let mockTrips = readyTrips();
const mockPush = jest.fn();
const mockPassports: { online: boolean; passports: FieldPassports | null } = { online: true, passports: null };
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;
const tripWindow = { closesAt: Date.UTC(2026, 10, 10) + 2 * DAY_MS - IST_MS, opensAt: Date.UTC(2026, 10, 5) - DAY_MS - IST_MS };
const metrics = { frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 47 } };

// Params behave like the router's: setting them re-renders the screen that reads them.
jest.mock('expo-router', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    router: { push: (...args: unknown[]) => mockPush(...args), setParams: (next: { view?: string }) => mockSetParams(next) },
    useLocalSearchParams: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockParamListeners.add(listener);
          return () => mockParamListeners.delete(listener);
        },
        () => mockParams.view
      ) === undefined
        ? {}
        : { view: mockParams.view },
  };
});
jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => mockTrips }));
const mockAnnouncements: { body: string }[] = [];
jest.mock('@/features/announcements/use-announcements', () => ({ useAnnouncements: () => ({ log: mockAnnouncements }) }));
jest.mock('@/features/passports/use-field-passports', () => ({ useFieldPassports: () => mockPassports }));
jest.mock('@/features/gate/session', () => ({
  useStaff: () => ({ name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' }),
  useStaffSession: () => ({ gate: { kind: 'staff', offline: false }, online: true }),
}));

describe('trip screen', () => {
  beforeEach(() => {
    delete mockParams.view;
    mockSetParams.mockClear();
    mockRefreshPack.mockClear();
    mockTrips = readyTrips();
    mockAnnouncements.length = 0;
    mockPush.mockReset();
    mockPassports.online = true;
    mockPassports.passports = null;
  });

  it('opens on the view Today links to', async () => {
    mockParams.view = 'contacts';
    await renderWithTheme(<TripPackScreen />);
    expect(screen.getByRole('tab', { name: 'Contacts' })).toBeSelected();
    expect(screen.getByText('Ops Person')).toBeOnTheScreen();
    expect(screen.queryByText('Asha Example')).not.toBeOnTheScreen();
  });

  it('shows the roster grouped by batch by default, and keeps the param in step when switching', async () => {
    await renderWithTheme(<TripPackScreen />);
    expect(screen.getByRole('tab', { name: 'Roster' })).toBeSelected();
    expect(screen.getByLabelText('Bus 1, 2 travelling')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bus 2, 1 travelling')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Asha Example, VIP .*calling: Called$/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'Schedule' }));
    expect(mockSetParams).toHaveBeenCalledWith({ view: 'schedule' });
    expect(screen.getByText('Ubud tour.')).toBeOnTheScreen();
    expect(screen.getByText('PR-TEST-1')).toBeOnTheScreen();
  });

  it('follows a new view param while the tab stays open', async () => {
    const view = await renderWithTheme(<TripPackScreen key="trip" />);
    expect(screen.queryByText('Arrive Denpasar.')).not.toBeOnTheScreen();
    mockParams.view = 'schedule';
    await view.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider theme={staffTheme}>
          <TripPackScreen key="trip" />
        </ThemeProvider>
      </SafeAreaProvider>
    );
    expect(screen.getByRole('tab', { name: 'Schedule' })).toBeSelected();
    expect(screen.getByText('Arrive Denpasar.')).toBeOnTheScreen();
  });

  it('takes the section from the param alone, so a link back to the view the param already names still lands', async () => {
    await renderWithTheme(<TripPackScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Contacts' }));
    expect(screen.getByRole('tab', { name: 'Contacts' })).toBeSelected();
    // Today links to the roster again: the param changes, and so does the section.
    await act(async () => mockSetParams({ view: 'roster' }));
    expect(screen.getByRole('tab', { name: 'Roster' })).toBeSelected();
  });

  it('says there are no trips yet, not to choose one on Today', async () => {
    mockTrips = { ...readyTrips(), pack: null, packStatus: { kind: 'loading' }, selected: null, tripsStatus: { kind: 'empty' } };
    await renderWithTheme(<TripPackScreen />);
    expect(screen.getByText(/^No trips yet\./)).toBeOnTheScreen();
    expect(screen.queryByText('Choose a trip on Today first.')).toBeNull();
  });

  it('holds the place of the roster while the pack downloads', async () => {
    mockTrips = { ...readyTrips(), pack: null, packStatus: { kind: 'fetching' } };
    await renderWithTheme(<TripPackScreen />);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    expect(screen.queryByText('No trip pack on this phone yet')).toBeNull();
  });

  it('offline, says saving the pack needs a connection instead of offering a button that does nothing', async () => {
    mockTrips = { ...readyTrips(), canRefresh: false, pack: null, packStatus: { kind: 'none' } };
    await renderWithTheme(<TripPackScreen />);
    expect(screen.getByText('No trip pack on this phone yet')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Connect to save' })).toBeDisabled();
  });

  it('saves the pack from the banner when online', async () => {
    mockTrips = { ...readyTrips(), pack: null, packStatus: { kind: 'failed' } };
    await renderWithTheme(<TripPackScreen />);
    expect(screen.getByText('Could not save the trip pack')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRefreshPack).toHaveBeenCalled();
  });

  it('opens earlier announcements from the trip', async () => {
    mockAnnouncements.push({ body: 'Lobby at 7.' }, { body: 'Bus leaves at 8.' });
    await renderWithTheme(<TripPackScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Announcements' }));
    expect(mockPush).toHaveBeenCalledWith('/announce');
    expect(screen.getByText('2 shared · Latest: Lobby at 7.')).toBeOnTheScreen();
  });

  it('marks the signed-in tour manager as You instead of offering a call', async () => {
    mockParams.view = 'contacts';
    await renderWithTheme(<TripPackScreen />);
    expect(await screen.findByLabelText('You')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Call Test Tour Manager' })).toBeNull();
  });

  it('offers a Passport action only for travellers the server says are available, and explains the window', async () => {
    jest.useFakeTimers({ now: tripWindow.opensAt + DAY_MS, doNotFake: ['nextTick', 'setImmediate'] });
    mockPassports.passports = {
      timeZone: 'Asia/Kolkata',
      travellers: [
        { available: true, hasPassportScan: true, mimeType: 'image/jpeg', travellerId: 't_2', ...tripWindow },
        { available: false, hasPassportScan: false, mimeType: null, travellerId: 't_1', ...tripWindow },
        { available: false, closesAt: null, hasPassportScan: true, mimeType: 'application/pdf', opensAt: null, travellerId: 't_3' },
      ],
    };
    try {
      await renderWithTheme(<TripPackScreen />);
      expect(screen.getByText('Passports · Available during the trip, until 11 Nov (India time)')).toBeOnTheScreen();
      expect(screen.getByText('Passports · Opens once the trip dates are set (India time)')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Passport, Zed Example' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Passport, Bina Example' })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Passport, Asha Example' }));
      expect(mockPush).toHaveBeenCalledWith({ params: { id: 't_2' }, pathname: '/passport/[id]' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers Passport for images and PDFs only, and says other files cannot be opened, without opening them', async () => {
    jest.useFakeTimers({ now: tripWindow.opensAt + DAY_MS, doNotFake: ['nextTick', 'setImmediate'] });
    mockPassports.passports = {
      timeZone: 'Asia/Kolkata',
      travellers: [
        { available: true, hasPassportScan: true, mimeType: 'image/heic', travellerId: 't_1', ...tripWindow },
        { available: true, hasPassportScan: true, mimeType: 'application/pdf', travellerId: 't_2', ...tripWindow },
        { available: true, hasPassportScan: true, mimeType: 'image/tiff', travellerId: 't_3', ...tripWindow },
      ],
    };
    try {
      await renderWithTheme(<TripPackScreen />);
      expect(screen.getByRole('button', { name: 'Passport, Zed Example' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Passport, Asha Example' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Passport, Bina Example' })).toBeNull();
      expect(screen.getByLabelText("Passport for Bina Example can't be opened in the app")).toBeOnTheScreen();
      expect(screen.getAllByText("Passport can't be opened in the app")).toHaveLength(1);
      // Nothing navigates to the viewer, so no audited read is made for a file nobody can see.
      expect(mockPush).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: 'Passport, Asha Example' }));
      expect(mockPush).toHaveBeenCalledWith({ params: { id: 't_2' }, pathname: '/passport/[id]' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('says when passports open before the window', async () => {
    jest.useFakeTimers({ now: tripWindow.opensAt - 1, doNotFake: ['nextTick', 'setImmediate'] });
    mockPassports.passports = {
      timeZone: 'Asia/Kolkata',
      travellers: [{ available: false, hasPassportScan: true, mimeType: 'image/jpeg', travellerId: 't_2', ...tripWindow }],
    };
    try {
      await renderWithTheme(<TripPackScreen />);
      expect(screen.getByText('Passports · Opens on 4 Nov (India time)')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Passport, Asha Example' })).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers no passports offline, and says they need a connection', async () => {
    mockPassports.online = false;
    await renderWithTheme(<TripPackScreen />);
    expect(screen.getByText('Passports open here only when you are online.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Passport,/ })).toBeNull();
  });
});
