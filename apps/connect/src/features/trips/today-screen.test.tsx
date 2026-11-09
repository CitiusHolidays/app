import { act, fireEvent, screen } from '@testing-library/react-native';

import Today from '@/app/(app)/index';
import { batches, commandCenter, jobCard, tourManagers, travellers } from '@/features/trip-pack/fixtures';
import { buildTripPack } from '@/features/trip-pack/trip-pack';
import { renderWithTheme } from '@/test/render';

const mockPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers });
const mockEmptyPack = buildTripPack({ batches, commandCenter, complete: true, savedAt: Date.now(), tourManagers, travellers: [] });
const otherTrip = { ...jobCard, clientName: 'Other Client', id: 'jc_other', jobCode: 'JC-TEST-002', status: 'Confirmed' };
const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockToast = jest.fn();
const mockRefreshPack = jest.fn(async () => undefined);
const mockRefreshTrips = jest.fn(async () => undefined);
const mockSelectTrip = jest.fn();
const mockSession = { gate: { kind: 'staff', offline: false }, online: true };
const mockSync: { items: unknown[] } = { items: [] };
const mockOutbox: { items: unknown[] } = { items: [] };
const mockHeadcount = { loaded: true };

type MockTrips = Record<string, unknown>;
const readyTrips = (): MockTrips => ({
  canRefresh: true,
  pack: mockPack,
  packLoading: false,
  packProblem: null,
  packStatus: { kind: 'ready', pack: mockPack },
  refreshing: false,
  refreshPack: mockRefreshPack,
  refreshTrips: mockRefreshTrips,
  selected: jobCard,
  selectTrip: mockSelectTrip,
  trips: [jobCard],
  tripsComplete: true,
  tripsProblem: null,
  tripsSavedAt: Date.now(),
  tripsStatus: { kind: 'ready' },
});
let mockTrips = readyTrips();

jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => mockTrips }));
jest.mock('@/features/gate/session', () => ({ useStaffSession: () => mockSession }));
jest.mock('@/features/field-sync/field-sync-context', () => ({ useFieldSync: () => mockSync }));
jest.mock('@/features/expenses/outbox-context', () => ({ useOutbox: () => mockOutbox }));
jest.mock('@/features/inbox/use-inbox', () => ({ useInbox: () => ({ rows: [] }) }));
jest.mock('@/features/headcount/use-headcount', () => ({
  useHeadcount: (jobCardId: string | null) => ({
    loaded: mockHeadcount.loaded,
    state: jobCardId ? jest.requireActual('@/features/headcount/headcount').startHeadcount(jobCardId, Date.now()) : null,
  }),
}));
jest.mock('@/lib/toast', () => ({ useToast: () => mockToast }));

type Node = { children?: readonly (Node | string)[]; props: Record<string, unknown> };
/** The scroll view's pull-to-refresh handler, as a pull would call it. */
function pullToRefresh() {
  const visit = (node: Node | string): (() => void) | null => {
    if (typeof node === 'string') return null;
    const control = node.props.refreshControl as { props: { onRefresh: () => void } } | undefined;
    if (control) return control.props.onRefresh;
    for (const child of node.children ?? []) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  const onRefresh = visit(screen.root as unknown as Node);
  if (!onRefresh) throw new Error('no pull to refresh');
  onRefresh();
}

const expense = (jobCardId: string, status: string) => ({ jobCardId, status });

describe('today screen', () => {
  beforeEach(() => {
    mockTrips = readyTrips();
    mockSession.online = true;
    mockSync.items = [];
    mockOutbox.items = [];
    mockHeadcount.loaded = true;
    [mockNavigate, mockPush, mockToast, mockRefreshPack, mockRefreshTrips, mockSelectTrip].forEach((mock) => mock.mockClear());
  });

  it("counts only the selected trip's waiting work, and opens the screen where it is", async () => {
    mockOutbox.items = [expense('jc_other', 'needsAttention'), expense(jobCard.id, 'needsAttention')];
    mockSync.items = [{ args: { jobCardId: 'jc_other' }, kind: 'headcountStop', status: 'needsAttention' }];
    await renderWithTheme(<Today />);
    const pill = screen.getByRole('button', { name: '1 expense needs a look' });
    await fireEvent.press(pill);
    expect(mockNavigate).toHaveBeenCalledWith('/expenses');
  });

  it('opens Headcount for a refused count', async () => {
    mockSync.items = [{ args: { jobCardId: jobCard.id }, kind: 'headcountStop', status: 'needsAttention' }];
    await renderWithTheme(<Today />);
    await fireEvent.press(screen.getByRole('button', { name: '1 headcount needs a look' }));
    expect(mockNavigate).toHaveBeenCalledWith('/headcount');
  });

  it('does not say everyone is marked when nobody is on the roster', async () => {
    mockTrips = { ...readyTrips(), pack: mockEmptyPack, packStatus: { kind: 'ready', pack: mockEmptyPack } };
    await renderWithTheme(<Today />);
    expect(screen.queryByText(/Everyone is marked/)).toBeNull();
    expect(screen.getByText(/^Nobody on this trip is travelling, so there is no one to count\./)).toBeOnTheScreen();
  });

  it("holds the count's place until today's headcount is read, instead of a false 0", async () => {
    mockHeadcount.loaded = false;
    await renderWithTheme(<Today />);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    expect(screen.queryByText(/here$/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take headcount' })).toBeNull();
  });

  it('offers to save a missing pack, like the Trip tab does', async () => {
    mockTrips = { ...readyTrips(), pack: null, packStatus: { kind: 'none' } };
    await renderWithTheme(<Today />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save trip pack' }));
    expect(mockRefreshPack).toHaveBeenCalled();
  });

  it("does not show another trip's pack error, and a stopped trip says so in its own words", async () => {
    mockTrips = { ...readyTrips(), pack: null, packStatus: { kind: 'off' } };
    await renderWithTheme(<Today />);
    expect(screen.getByText('This trip is not live in the app any more')).toBeOnTheScreen();
    expect(screen.queryByText('No trip pack on this phone yet')).toBeNull();
    expect(screen.queryByText(/Showing the saved copy/)).toBeNull();
  });

  it('holds the trip card and headcount places while the first trip list loads, instead of saying there are no trips', async () => {
    mockTrips = { ...readyTrips(), pack: null, packStatus: { kind: 'loading' }, selected: null, trips: [], tripsStatus: { kind: 'loading' } };
    await renderWithTheme(<Today />);
    expect(screen.queryByText(/^No trips yet/)).toBeNull();
    expect(screen.getAllByLabelText('Loading')).toHaveLength(2);
  });

  it('says when the first trip list could not be loaded', async () => {
    mockTrips = { ...readyTrips(), pack: null, selected: null, trips: [], tripsStatus: { kind: 'failed' } };
    await renderWithTheme(<Today />);
    expect(screen.getByText('Could not load your trips. Pull down to try again.')).toBeOnTheScreen();
    expect(screen.queryByText(/^No trips yet/)).toBeNull();
  });

  it('says it is offline when a pull to refresh cannot fetch anything', async () => {
    mockTrips = { ...readyTrips(), canRefresh: false };
    await renderWithTheme(<Today />);
    await act(async () => pullToRefresh());
    expect(mockToast).toHaveBeenCalledWith('Offline. Showing what is saved on this phone.', 'saved');
    expect(mockRefreshTrips).not.toHaveBeenCalled();
  });

  it('marks the trip on show with a check, gives every status as text, and confirms a switch', async () => {
    mockTrips = { ...readyTrips(), trips: [jobCard, otherTrip] };
    await renderWithTheme(<Today />);
    expect(screen.queryByText('Selected')).toBeNull();
    expect(screen.getByRole('button', { name: /^Example Cement Dealers, .*, showing now$/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Other Client, .*Confirmed$/ }));
    expect(mockSelectTrip).toHaveBeenCalledWith('jc_other');
    expect(mockToast).toHaveBeenCalledWith('Showing Other Client');
  });
});
