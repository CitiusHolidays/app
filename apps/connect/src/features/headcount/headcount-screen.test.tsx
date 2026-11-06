import { fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import Headcount from '@/app/headcount';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { AppStoreProvider } from '@/lib/app-store';
import { renderWithTheme } from '@/test/render';

jest.mock('@/lib/storage/device-store', () => ({
  openDeviceStore: async () => jest.requireActual('@/lib/storage/memory-store').createMemoryStore(),
}));

const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers });
jest.mock('@/features/trips/trips-context', () => ({
  useTrips: () => ({ pack: mockPack, selected: { id: mockPack.jobCardId } }),
}));

describe('headcount screen', () => {
  let announce: jest.SpyInstance;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });
  afterEach(() => announce.mockRestore());

  it('counts travellers as they are tapped, lists who is not marked, and announces the count on iOS', async () => {
    await renderWithTheme(
      <AppStoreProvider fallback={null}>
        <Headcount />
      </AppStoreProvider>
    );
    expect(await screen.findByLabelText('0 of 3 here')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Asha Example' }));
    expect(await screen.findByLabelText('1 of 3 here')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Asha Example' })).toBeChecked();
    expect(announce).toHaveBeenCalledWith('1 of 3 here');

    await fireEvent.press(screen.getByRole('radio', { name: 'Bus 2' }));
    expect(await screen.findByLabelText('0 of 1 here')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Asha Example' })).not.toBeOnTheScreen();
  });

  it('starts a new stop with nobody marked', async () => {
    await renderWithTheme(
      <AppStoreProvider fallback={null}>
        <Headcount />
      </AppStoreProvider>
    );
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Zed Example' }));
    await fireEvent.changeText(screen.getByLabelText('Next stop'), 'Temple car park');
    await fireEvent.press(screen.getByRole('button', { name: 'Start new stop' }));
    expect(await screen.findByLabelText('0 of 3 here')).toBeOnTheScreen();
    expect(screen.getByText(/Temple car park/)).toBeOnTheScreen();
  });
});
