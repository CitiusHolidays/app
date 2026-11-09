import { type NotificationRow, staffApi } from '@citius/backend';
import { staffTheme, ThemeProvider } from '@citius/ui';
import { render, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Inbox from '@/app/(app)/inbox';
import NotificationDetail from '@/app/notification/[id]';
import { renderWithTheme } from '@/test/render';

import { inboxState } from './use-inbox';

const unreadRow: NotificationRow = {
  body: 'Bus 2 leaves at 08:00 tomorrow.',
  createdAt: '2026-11-06T02:00:00.000Z',
  entityId: 'jc_1',
  entityType: 'jobCard',
  id: 'note_1',
  readAt: null,
  title: 'Departure moved',
};

const mockState = {
  cache: null as { rows: NotificationRow[]; savedAt: number } | null,
  cacheRead: true,
  gate: { kind: 'staff', offline: false } as { kind: 'staff'; offline: boolean },
  jobCard: undefined as unknown,
  online: true,
  rows: undefined as NotificationRow[] | undefined,
};
const mockMarkRead = jest.fn(async () => ({ id: 'note_1' }));
const mockQueryArgs: { ref: unknown; args: unknown }[] = [];

function mockAnswer(ref: unknown, args: unknown) {
  mockQueryArgs.push({ args, ref });
  if (args === 'skip') return undefined;
  return ref === staffApi.listNotifications.ref ? mockState.rows : mockState.jobCard;
}

jest.mock('convex/react', () => ({
  useMutation: () => mockMarkRead,
  useQuery: (ref: unknown, args: unknown) => mockAnswer(ref, args),
}));
jest.mock('@/lib/app-store', () => ({
  useStoredValue: () => [mockState.cache, () => undefined, mockState.cacheRead],
}));
jest.mock('@/features/gate/session', () => ({
  useStaffSession: () => ({ gate: mockState.gate, online: mockState.online }),
}));
jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => ({ selectTrip: () => undefined, trips: [] }) }));
jest.mock('expo-router', () => ({
  router: { navigate: () => undefined, push: () => undefined },
  useLocalSearchParams: () => ({ id: 'note_1' }),
}));

const metrics = { frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 47 } };
/** The same providers as renderWithTheme, so a rerender keeps them. */
const themed = (element: ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider theme={staffTheme}>{element}</ThemeProvider>
  </SafeAreaProvider>
);

beforeEach(() => {
  mockState.cache = null;
  mockState.cacheRead = true;
  mockState.gate = { kind: 'staff', offline: false };
  mockState.jobCard = undefined;
  mockState.online = true;
  mockState.rows = undefined;
  mockMarkRead.mockClear();
  mockQueryArgs.length = 0;
});

describe('inboxState', () => {
  it('tells a list that has never loaded apart from an empty one', () => {
    const base = { cache: null, cacheRead: true, canFetch: true, live: undefined };
    expect(inboxState({ ...base, cacheRead: false }).kind).toBe('reading');
    expect(inboxState(base).kind).toBe('fetching');
    expect(inboxState({ ...base, canFetch: false }).kind).toBe('unreachable');
    expect(inboxState({ ...base, cache: { rows: [], savedAt: 1 } })).toEqual({ kind: 'cached', rows: [], savedAt: 1 });
    expect(inboxState({ ...base, live: [] })).toEqual({ kind: 'live', rows: [] });
  });
});

describe('inbox screen', () => {
  it('does not say "all caught up" before the list has loaded', async () => {
    await renderWithTheme(<Inbox />);
    expect(screen.queryByText("You're all caught up.")).not.toBeOnTheScreen();
  });

  it('asks for a connection when the phone is offline with nothing saved', async () => {
    mockState.online = false;
    await renderWithTheme(<Inbox />);
    expect(screen.getByText('Connect to load your inbox. It stays on this phone once it has loaded.')).toBeOnTheScreen();
    expect(screen.queryByText("You're all caught up.")).not.toBeOnTheScreen();
  });

  it('lists unread notifications under New, and read ones under Earlier', async () => {
    mockState.rows = [unreadRow];
    const view = await render(themed(<Inbox />));
    expect(screen.getByText('New · 1')).toBeOnTheScreen();
    expect(screen.queryByText('Earlier')).not.toBeOnTheScreen();

    // The live query answers again once the detail screen has marked it read.
    mockState.rows = [{ ...unreadRow, readAt: '2026-11-06T03:00:00.000Z' }];
    await view.rerender(themed(<Inbox />));
    expect(screen.getByText("You're all caught up.")).toBeOnTheScreen();
    expect(screen.getByText('Earlier')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Departure moved\./)).toBeOnTheScreen();
  });
});

describe('notification detail', () => {
  it('marks the notification read once when it opens online', async () => {
    mockState.rows = [unreadRow];
    const view = await render(themed(<NotificationDetail />));
    expect(mockMarkRead).toHaveBeenCalledWith({ notificationId: 'note_1' });
    await view.rerender(themed(<NotificationDetail />));
    expect(mockMarkRead).toHaveBeenCalledTimes(1);
  });

  it('leaves it unread offline, and says to connect for the full record', async () => {
    mockState.cache = { rows: [unreadRow], savedAt: Date.now() };
    mockState.online = false;
    await renderWithTheme(<NotificationDetail />);
    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(screen.getByText('Connect to load the full record.')).toBeOnTheScreen();
  });

  it('asks for the job card the way the rest of Connect does, and keeps its rows while it loads', async () => {
    mockState.rows = [unreadRow];
    await renderWithTheme(<NotificationDetail />);
    const call = mockQueryArgs.find((entry) => entry.ref === staffApi.getJobCardDetail.ref);
    expect(call?.args).toEqual({ jobCardId: 'jc_1', surface: 'connect' });
    const loading = screen.getByLabelText('Loading');
    expect(within(loading).getByText('Dates')).toBeOnTheScreen();
    expect(screen.queryByText(/Open Citius Connect on the web portal/)).not.toBeOnTheScreen();
  });
});
