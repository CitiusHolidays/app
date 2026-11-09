import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Alert, type AlertButton } from 'react-native';

import Headcount from '@/app/headcount';
import { refusedWith, syncedAt } from '@/features/field-sync/fixtures';
import type { FieldPush, SyncItem } from '@/features/field-sync/queue';
import { enqueuePush, syncKey } from '@/features/field-sync/queue';
import { batches, commandCenter, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack, type TripPack } from '@/features/trip-pack/trip-pack';
import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';
import { renderWithTheme } from '@/test/render';

import { headcountKey, localDay, startHeadcount, togglePresent } from './headcount';

let mockStore: KeyValueStore;
jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));

const fullPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers });
const mockTrips: { pack: TripPack } = { pack: fullPack };
jest.mock('@/features/trips/trips-context', () => ({
  useTrips: () => ({ pack: mockTrips.pack, selected: { id: mockTrips.pack.jobCardId } }),
}));
const mockSync = { discard: jest.fn(), enqueue: jest.fn(), items: [] as SyncItem[], retry: jest.fn() };
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => mockSync }));

const lastPush = () => mockSync.enqueue.mock.calls.at(-1)?.[0] as FieldPush;

async function renderHeadcount() {
  return renderWithTheme(
    <AppStoreProvider fallback={null}>
      <Headcount />
    </AppStoreProvider>
  );
}

/** Presses one button of the Alert the screen just raised. */
async function answerAlert(alert: jest.SpyInstance, text: string) {
  const buttons = (alert.mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  const button = buttons.find((candidate) => candidate.text === text);
  if (!button) throw new Error(`no "${text}" button`);
  await act(async () => button.onPress?.());
}

describe('headcount screen', () => {
  let announce: jest.SpyInstance;
  let alert: jest.SpyInstance;
  beforeEach(() => {
    mockStore = jest.requireActual('@/lib/storage/memory-store').createMemoryStore();
    mockTrips.pack = fullPack;
    mockSync.discard.mockReset();
    mockSync.enqueue.mockReset();
    mockSync.retry.mockReset();
    mockSync.items = [];
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => {
    announce.mockRestore();
    alert.mockRestore();
  });

  it('counts travellers as they are tapped, lists who is not marked, and announces the count on iOS', async () => {
    await renderHeadcount();
    expect(await screen.findByLabelText('0 of 3 here')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Asha Example' }));
    expect(await screen.findByLabelText('1 of 3 here')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Asha Example' })).toBeChecked();
    expect(announce).toHaveBeenCalledWith('1 of 3 here');

    await fireEvent.press(screen.getByRole('radio', { name: 'Bus 2' }));
    expect(await screen.findByLabelText('0 of 1 here')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Asha Example' })).not.toBeOnTheScreen();
  });

  it('shows nothing to tap until today’s record is read, so an early tap cannot overwrite it', async () => {
    const day = localDay(Date.now());
    const saved = togglePresent(startHeadcount(fullPack.jobCardId, Date.now()), 't_1', Date.now());
    await mockStore.setJSON(headcountKey(fullPack.jobCardId, day), saved);
    // The encrypted store is slow to answer for today's record.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const read = mockStore.getJSON.bind(mockStore);
    mockStore = { ...mockStore, getJSON: async (key) => (key.startsWith('headcount:') ? gate.then(() => read(key)) : read(key)) } as KeyValueStore;

    await renderHeadcount();
    expect(await screen.findByLabelText("Loading today's headcount")).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start new stop' })).not.toBeOnTheScreen();

    await act(async () => release());
    expect(await screen.findByLabelText('1 of 3 here')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Zed Example' })).toBeChecked();
    expect(mockSync.enqueue).not.toHaveBeenCalled();
  });

  it('asks before starting a new stop, then starts it with nobody marked and lists the stop it left', async () => {
    await renderHeadcount();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Zed Example' }));
    await fireEvent.changeText(screen.getByLabelText('Next stop'), 'Temple car park');
    await fireEvent.press(screen.getByRole('button', { name: 'Start new stop' }));
    expect(alert).toHaveBeenCalledWith(
      'Start Temple car park?',
      "Start of day stays in today's record: 1 of 3 here. The new stop starts with nobody marked.",
      expect.any(Array)
    );

    // Cancel changes nothing, and keeps the typed name.
    await answerAlert(alert, 'Cancel');
    expect(screen.getByLabelText('1 of 3 here')).toBeOnTheScreen();
    expect(screen.getByLabelText('Next stop').props.value).toBe('Temple car park');

    await fireEvent.press(screen.getByRole('button', { name: 'Start new stop' }));
    await answerAlert(alert, 'Start stop');
    expect(await screen.findByLabelText('0 of 3 here')).toBeOnTheScreen();
    expect(screen.getByText(/Headcount · Temple car park/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Next stop').props.value).toBe('');
    expect(screen.getByText('Earlier today')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Start of day, Started \d{2}:\d{2} · 1 of 3 here$/)).toBeOnTheScreen();
  });

  it("asks from the keyboard's Go key too, without reaching for the button", async () => {
    await renderHeadcount();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Zed Example' }));
    const field = screen.getByLabelText('Next stop');
    await fireEvent.changeText(field, 'Lunch stop');
    await fireEvent(field, 'submitEditing');
    await answerAlert(alert, 'Start stop');
    expect(await screen.findByLabelText('0 of 3 here')).toBeOnTheScreen();
    expect(screen.getByText(/Headcount · Lunch stop/)).toBeOnTheScreen();
  });

  it('sends each change of the stop to the office, as a count of the whole group', async () => {
    await renderHeadcount();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Asha Example' }));
    expect(lastPush()).toMatchObject({ args: { jobCardId: fullPack.jobCardId, label: 'Start of day', presentTravellerIds: ['t_2'] }, kind: 'headcountStop' });
    const firstStop = lastPush().args;

    await fireEvent.press(screen.getByRole('radio', { name: 'Bus 2' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Bina Example' }));
    expect(lastPush().args).toMatchObject({ presentTravellerIds: ['t_2', 't_3'] });
    expect(lastPush().args).not.toHaveProperty('travelBatchId');
    expect(syncKey(lastPush())).toBe(syncKey({ args: firstStop, kind: 'headcountStop' } as FieldPush));

    await fireEvent.changeText(screen.getByLabelText('Next stop'), 'Temple car park');
    await fireEvent.press(screen.getByRole('button', { name: 'Start new stop' }));
    await answerAlert(alert, 'Start stop');
    expect(lastPush().args).toMatchObject({ label: 'Temple car park', presentTravellerIds: [] });
  });

  it('names the batch only when one is chosen, when nobody is left to mark', async () => {
    await renderHeadcount();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Not marked' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Bus 2' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Bina Example' }));
    expect(await screen.findByLabelText('Everyone in Bus 2 is marked.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Everyone' }));
    for (const name of ['Zed Example', 'Asha Example']) await fireEvent.press(screen.getByRole('checkbox', { name }));
    expect(await screen.findByLabelText('Everyone here is marked.')).toBeOnTheScreen();
  });

  it('says so when nobody on the trip is travelling, instead of counting 0 of 0', async () => {
    mockTrips.pack = { ...fullPack, roster: fullPack.roster.map((entry) => ({ ...entry, travelling: false })) };
    await renderHeadcount();
    expect(await screen.findByLabelText(/^Nobody on this trip is travelling/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('0 of 0 here')).not.toBeOnTheScreen();
    expect(screen.queryByText(/is marked/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start new stop' })).not.toBeOnTheScreen();
  });

  it('shows whether the count has reached the office, and lets a refused one be retried or stopped', async () => {
    await renderHeadcount();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Asha Example' }));
    const [queued] = enqueuePush([], lastPush(), 'staff_1', Date.now());
    if (!queued) throw new Error('no item');

    mockSync.items = [queued];
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Zed Example' }));
    expect(screen.getByLabelText('Waiting to sync')).toBeOnTheScreen();

    mockSync.items = [syncedAt(queued, Date.now(), 1)];
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Zed Example' }));
    expect(screen.getByLabelText(/^Synced to office \d{2}:\d{2}$/)).toBeOnTheScreen();
    expect(screen.getByText(/1 marked traveller is not in your group/)).toBeOnTheScreen();

    mockSync.items = [refusedWith(queued, 'The office did not accept this.')];
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Zed Example' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(mockSync.retry).toHaveBeenCalledWith([queued.key]);

    await fireEvent.press(screen.getByRole('button', { name: 'Stop sending' }));
    expect(alert).toHaveBeenCalledWith('Stop sending this update?', expect.stringMatching(/stays on this phone/), expect.any(Array));
    await answerAlert(alert, 'Keep');
    expect(mockSync.discard).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Stop sending' }));
    await answerAlert(alert, 'Stop sending');
    expect(mockSync.discard).toHaveBeenCalledWith([queued.key]);
  });
});
