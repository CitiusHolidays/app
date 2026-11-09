import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert, type AlertButton, Platform, Share } from 'react-native';

import Announce from '@/app/announce';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { AppStoreProvider } from '@/lib/app-store';
import { renderWithTheme } from '@/test/render';

const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: 0, tourManagers, travellers });
const mockJobCard = commandCenter.jobCard;
const mockEnqueue = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/lib/storage/device-store', () => ({
  openDeviceStore: async () => jest.requireActual('@/lib/storage/memory-store').createMemoryStore(),
}));
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => ({ enqueue: mockEnqueue }) }));
jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => ({ pack: mockPack, selected: mockJobCard }) }));
jest.mock('@/features/gate/session', () => ({ useStaff: () => ({ name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) } }));

async function writeAndShare() {
  await renderWithTheme(
    <AppStoreProvider fallback={null}>
      <Announce />
    </AppStoreProvider>
  );
  await fireEvent.changeText(await screen.findByLabelText('Message'), 'Bus at 8:15');
  await fireEvent.press(screen.getByRole('button', { name: 'Share message' }));
}

/** Presses one button of the Alert the screen just raised. */
async function answerAlert(alert: jest.SpyInstance, text: string) {
  const buttons = (alert.mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  const button = buttons.find((candidate) => candidate.text === text);
  if (!button) throw new Error(`no "${text}" button`);
  await act(async () => button.onPress?.());
}

describe('announcement composer', () => {
  let alert: jest.SpyInstance;
  let share: jest.SpyInstance;
  beforeEach(() => {
    mockEnqueue.mockReset();
    mockReplace.mockReset();
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    // Android's share sheet reports "shared" whether or not the message went out.
    share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  });
  afterEach(() => {
    alert.mockRestore();
    share.mockRestore();
    jest.restoreAllMocks();
  });

  it('logs the announcement on iOS once the share sheet reports it shared, and opens its checklist on that trip', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await writeAndShare();
    expect(alert).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ params: { id: expect.any(String), trip: mockPack.jobCardId }, pathname: '/announcement/[id]' });
  });

  it('logs nothing when the iOS share sheet is dismissed', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    share.mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    await writeAndShare();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('asks on Android whether the message was sent, and logs nothing if it was not', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await writeAndShare();
    expect(alert).toHaveBeenCalledWith('Did you send it?', expect.any(String), expect.any(Array), expect.objectContaining({ cancelable: true }));
    await answerAlert(alert, 'Not sent');
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    // The message is still there to send again.
    expect(screen.getByLabelText('Message').props.value).toBe('Bus at 8:15');
  });

  it('logs and sends the announcement on Android once the tour manager says it was sent', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await writeAndShare();
    await answerAlert(alert, 'Yes, sent');
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('logs nothing on Android when the question is dismissed', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await writeAndShare();
    const options = alert.mock.calls.at(-1)?.[3] as { onDismiss?: () => void };
    await act(async () => options.onDismiss?.());
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
