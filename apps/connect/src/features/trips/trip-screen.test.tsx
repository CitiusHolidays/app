import { staffTheme, ThemeProvider } from '@citius/ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TripPackScreen from '@/app/(app)/trip';
import { batches, commandCenter, jobCard, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { renderWithTheme } from '@/test/render';

const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers });
const mockParams: { view?: string } = {};
const mockSetParams = jest.fn();
const mockJobCard = jobCard;
const metrics = { frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 47 } };

jest.mock('expo-router', () => ({
  router: { setParams: (...args: unknown[]) => mockSetParams(...args) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/features/trips/trips-context', () => ({
  useTrips: () => ({ pack: mockPack, packLoading: false, packProblem: null, refreshPack: async () => undefined, selected: mockJobCard }),
}));
jest.mock('@/features/gate/session', () => ({
  useStaffSession: () => ({ gate: { kind: 'staff', offline: false }, online: true }),
}));

describe('trip screen', () => {
  beforeEach(() => {
    delete mockParams.view;
    mockSetParams.mockReset();
  });

  it('opens on the view Today links to', async () => {
    mockParams.view = 'contacts';
    await renderWithTheme(<TripPackScreen />);
    expect(screen.getByRole('tab', { name: 'Contacts' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Call Test Tour Manager' })).toBeOnTheScreen();
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
});
