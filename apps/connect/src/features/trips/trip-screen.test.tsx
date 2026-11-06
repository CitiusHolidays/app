import { staffTheme, ThemeProvider } from '@citius/ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { FieldPassports } from '@citius/backend';

import TripPackScreen from '@/app/(app)/trip';
import { batches, commandCenter, jobCard, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { renderWithTheme } from '@/test/render';

const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers });
const mockParams: { view?: string } = {};
const mockSetParams = jest.fn();
const mockPush = jest.fn();
const mockPassports: { online: boolean; passports: FieldPassports | null } = { online: true, passports: null };
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;
const tripWindow = { closesAt: Date.UTC(2026, 10, 10) + 2 * DAY_MS - IST_MS, opensAt: Date.UTC(2026, 10, 5) - DAY_MS - IST_MS };
const mockJobCard = jobCard;
const metrics = { frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 47 } };

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), setParams: (...args: unknown[]) => mockSetParams(...args) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/features/trips/trips-context', () => ({
  useTrips: () => ({ pack: mockPack, packLoading: false, packProblem: null, refreshPack: async () => undefined, selected: mockJobCard }),
}));
jest.mock('@/features/passports/use-field-passports', () => ({ useFieldPassports: () => mockPassports }));
jest.mock('@/features/gate/session', () => ({
  useStaff: () => ({ name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' }),
  useStaffSession: () => ({ gate: { kind: 'staff', offline: false }, online: true }),
}));

describe('trip screen', () => {
  beforeEach(() => {
    delete mockParams.view;
    mockSetParams.mockReset();
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
        { available: true, hasPassportScan: true, travellerId: 't_2', ...tripWindow },
        { available: false, hasPassportScan: false, travellerId: 't_1', ...tripWindow },
        { available: false, closesAt: null, hasPassportScan: true, opensAt: null, travellerId: 't_3' },
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

  it('says when passports open before the window', async () => {
    jest.useFakeTimers({ now: tripWindow.opensAt - 1, doNotFake: ['nextTick', 'setImmediate'] });
    mockPassports.passports = { timeZone: 'Asia/Kolkata', travellers: [{ available: false, hasPassportScan: true, travellerId: 't_2', ...tripWindow }] };
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
