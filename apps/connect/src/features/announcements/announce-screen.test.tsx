import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton, AppState, Platform, Share } from 'react-native';

import Announce from '@/app/announce';
import { type FieldPush, type SyncItem, syncKey } from '@/features/field-sync/queue';
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
const mockSyncItems: SyncItem[] = [];
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => ({ enqueue: mockEnqueue, items: mockSyncItems }) }));
jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => ({ pack: mockPack, selected: mockJobCard }) }));
jest.mock('@/features/gate/session', () => ({ useStaff: () => ({ name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' }) }));
const mockAllowLeave = jest.fn();
/** What the screen last asked of usePreventRemove: whether to guard, and what to do when it does. */
const mockGuard: { onBlocked?: (event: { repeat: () => void }) => void; prevent: boolean } = { prevent: false };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
  usePreventRemove: (prevent: boolean, onBlocked: (event: { repeat: () => void }) => void) => {
    mockGuard.prevent = prevent;
    mockGuard.onBlocked = onBlocked;
    return mockAllowLeave;
  },
}));

async function writeAndShare() {
  await renderWithTheme(
    <AppStoreProvider fallback={null}>
      <Announce />
    </AppStoreProvider>
  );
  await fireEvent.changeText(await screen.findByLabelText('Message'), 'Bus at 8:15');
  await fireEvent.press(screen.getByRole('button', { name: 'Share message' }));
}

let appStateListeners: ((state: string) => void)[] = [];

/** The Android share sheet covers the app, then closes and hands it back. */
async function returnFromShareSheet() {
  await act(async () => {
    for (const listener of [...appStateListeners]) listener('background');
  });
  await act(async () => {
    for (const listener of [...appStateListeners]) listener('active');
  });
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
    mockSyncItems.length = 0;
    mockReplace.mockReset();
    mockAllowLeave.mockReset();
    mockGuard.prevent = false;
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    // Android's share sheet reports "shared" whether or not the message went out.
    share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      const typed = listener as (state: string) => void;
      appStateListeners.push(typed);
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter((candidate) => candidate !== typed);
        },
      } as ReturnType<typeof AppState.addEventListener>;
    });
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

  it('marks an earlier announcement the office refused, so the one to open is easy to find', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    // The office refuses what the phone sends.
    mockEnqueue.mockImplementation((push: FieldPush) => {
      mockSyncItems.push({ ...push, key: syncKey(push), landed: undefined, problem: 'No', staffId: 'staff_1', status: 'needsAttention', updatedAt: 0 });
    });
    await writeAndShare();
    expect(await screen.findByText('Earlier announcements')).toBeOnTheScreen();
    expect(screen.getByLabelText('Not synced to the office')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Bus at 8:15\. .*Not synced to the office$/ })).toBeOnTheScreen();
  });

  it('logs nothing when the iOS share sheet is dismissed', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    share.mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    await writeAndShare();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('asks on Android only once the share sheet has closed, since a question raised behind it is lost', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await writeAndShare();
    await act(async () => {
      for (const listener of [...appStateListeners]) listener('background');
    });
    expect(alert).not.toHaveBeenCalled();
    await act(async () => {
      for (const listener of [...appStateListeners]) listener('active');
    });
    expect(alert).toHaveBeenCalledWith('Did you send it?', expect.any(String), expect.any(Array), expect.any(Object));
    expect(appStateListeners).toHaveLength(0);
  });

  it('asks on Android anyway when the share sheet never covers the app', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await writeAndShare();
    expect(alert).not.toHaveBeenCalled();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Did you send it?', expect.any(String), expect.any(Array), expect.any(Object)), {
      timeout: 3000,
    });
  });

  it('asks on Android whether the message was sent, and logs nothing if it was not', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await writeAndShare();
    await returnFromShareSheet();
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
    await returnFromShareSheet();
    await answerAlert(alert, 'Yes, sent');
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('logs nothing on Android when the question is dismissed', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await writeAndShare();
    await returnFromShareSheet();
    const options = alert.mock.calls.at(-1)?.[3] as { onDismiss?: () => void };
    await act(async () => options.onDismiss?.());
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('asks before closing once a message is written, and closes on Discard', async () => {
    await renderWithTheme(
      <AppStoreProvider fallback={null}>
        <Announce />
      </AppStoreProvider>
    );
    const field = await screen.findByLabelText('Message');
    expect(mockGuard.prevent).toBe(false);
    await fireEvent.changeText(field, 'Bus at 8:15');
    expect(mockGuard.prevent).toBe(true);
    const repeat = jest.fn();
    await act(async () => mockGuard.onBlocked?.({ repeat }));
    expect(alert).toHaveBeenCalledWith('Discard this message?', expect.any(String), expect.any(Array));
    await answerAlert(alert, 'Keep editing');
    expect(repeat).not.toHaveBeenCalled();
    await answerAlert(alert, 'Discard');
    expect(repeat).toHaveBeenCalledTimes(1);
    // The guard turns off with the leave, so navigation does not warn that it is still on.
    expect(mockGuard.prevent).toBe(false);
  });

  it('opens the checklist after a share without the discard question', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await writeAndShare();
    expect(mockAllowLeave).toHaveBeenCalledTimes(1);
    expect(mockAllowLeave.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0] ?? 0);
  });
});
