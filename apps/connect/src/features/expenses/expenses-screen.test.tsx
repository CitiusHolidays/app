import type { ExpenseRow } from '@citius/backend';
import { fireEvent, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import Expenses from '@/app/(app)/expenses';
import { renderWithTheme } from '@/test/render';

import { createOutboxItem, type OutboxItem } from './outbox';
import { serverExpenses } from './server-expenses';

const tripA = { clientName: 'Client A', destination: 'Bali', id: 'jc_a', jobCode: 'JC-A', status: 'Confirmed', travelBatchCount: 1, travelEndDate: '2026-11-10', travelStartDate: '2026-11-04' };
const tripB = { ...tripA, clientName: 'Client B', id: 'jc_b', jobCode: 'JC-B' };
const mockTrips = { selected: tripA as typeof tripA | null, trips: [tripA, tripB] };
const mockOutbox = { discard: jest.fn(), items: [] as OutboxItem[], retry: jest.fn() };
const mockSession = { gate: { kind: 'staff', offline: false }, online: true };
let mockServer: { continueCursor: string; isDone: boolean; page: ExpenseRow[] } | undefined;

jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => mockTrips }));
jest.mock('@/features/expenses/outbox-context', () => ({ useOutbox: () => mockOutbox }));
jest.mock('@/features/gate/session', () => ({ useStaffSession: () => mockSession }));
jest.mock('convex/react', () => ({ useQuery: (_ref: unknown, args: unknown) => (args === 'skip' ? undefined : mockServer) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function item(id: string, jobCardId: string, particulars: string) {
  return createOutboxItem({
    draft: { amount: 900, category: 'Transport', currency: 'INR', expenseDate: '2026-11-05', paidBy: 'TM', particulars },
    id,
    jobCardId,
    now: 0,
    receipt: { fileName: 'r.jpg', mimeType: 'image/jpeg', size: 1, uri: 'file:///r.jpg' },
    staffId: 'staff_1',
  });
}

function row(id: string, particulars: string): ExpenseRow {
  return {
    amount: 900,
    approvalStatus: 'Pending',
    category: 'Transport',
    createdAt: '2026-11-05T08:00:00.000Z',
    currency: 'INR',
    expenseDate: '2026-11-05',
    id,
    jobCardId: 'jc_a',
    jobCode: 'JC-A',
    managerReviewStatus: 'Pending',
    notes: '',
    particulars,
    proofAttachment: null,
    submittedForApprovalAt: '2026-11-05T08:00:00.000Z',
  };
}

/** Presses the button with this text in the alert that is open. */
function pressAlertButton(text: string) {
  const buttons = (jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
}

describe('expenses screen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockOutbox.discard.mockReset();
    mockOutbox.items = [];
    mockTrips.selected = tripA;
    mockTrips.trips = [tripA, tripB];
    mockSession.online = true;
    mockServer = { continueCursor: '', isDone: true, page: [] };
  });

  it('says there is no trip yet, not that the phone is offline, when no trip is assigned', async () => {
    mockTrips.selected = null;
    mockTrips.trips = [];
    await renderWithTheme(<Expenses />);
    expect(screen.getByText('No trips yet. Expenses show here once Operations assigns you a trip.')).toBeOnTheScreen();
    expect(screen.queryByText(/Connect to the internet/)).not.toBeOnTheScreen();
  });

  it('keeps a refused expense for another trip in view, marked with that trip', async () => {
    const refused: OutboxItem = { ...item('ob_b', 'jc_b', 'Ferry tickets'), expenseId: 'exp_b', problem: 'This trip is no longer assigned to you.', stage: 'created', status: 'needsAttention' };
    mockOutbox.items = [refused];
    await renderWithTheme(<Expenses />);
    expect(screen.getByText('Ferry tickets')).toBeOnTheScreen();
    expect(screen.getByText(/^JC-B · Transport/)).toBeOnTheScreen();
    expect(screen.getByText('This trip is no longer assigned to you.')).toBeOnTheScreen();
  });

  it('lists a sent expense once, under Submitted, not again on the phone', async () => {
    mockOutbox.items = [{ ...item('ob_a', 'jc_a', 'Airport taxi'), expenseId: 'exp_a', stage: 'submitted', status: 'done' }];
    mockServer = { continueCursor: '', isDone: true, page: [row('exp_a', 'Airport taxi')] };
    await renderWithTheme(<Expenses />);
    expect(screen.getAllByText('Airport taxi')).toHaveLength(1);
    expect(screen.queryByText('On this phone')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Sent')).not.toBeOnTheScreen();
  });

  it('asks before deleting, and says a draft already on the server stays on the portal', async () => {
    mockOutbox.items = [{ ...item('ob_a', 'jc_a', 'Hotel deposit'), expenseId: 'exp_a', problem: 'Refused.', stage: 'attached', status: 'needsAttention' }];
    await renderWithTheme(<Expenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(mockOutbox.discard).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Delete this expense?', expect.stringContaining('stays there'), expect.any(Array));

    pressAlertButton('Cancel');
    expect(mockOutbox.discard).not.toHaveBeenCalled();
    pressAlertButton('Delete');
    expect(mockOutbox.discard).toHaveBeenCalledWith('ob_a');
  });

  it('says nothing reached the portal when the refused expense was never created there', async () => {
    mockOutbox.items = [{ ...item('ob_a', 'jc_a', 'Tips'), problem: 'Refused.', stage: 'queued', status: 'needsAttention' }];
    await renderWithTheme(<Expenses />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(Alert.alert).toHaveBeenCalledWith('Delete this expense?', expect.stringContaining('Nothing was sent'), expect.any(Array));
  });

  it('holds the space of the loaded list while the server answers', async () => {
    mockServer = undefined;
    await renderWithTheme(<Expenses />);
    expect(screen.getAllByLabelText('Loading')).toHaveLength(2);
    expect(screen.queryByText(/Connect to the internet/)).not.toBeOnTheScreen();
  });
});

describe('the server list state', () => {
  const result = { isDone: false, page: [row('exp_1', '')] };

  it('names why the list cannot be shown, in order: no trip, offline, then loading', () => {
    expect(serverExpenses({ canQuery: true, hasTrip: false, result })).toEqual({ kind: 'noTrip' });
    expect(serverExpenses({ canQuery: false, hasTrip: true, result })).toEqual({ kind: 'offline' });
    expect(serverExpenses({ canQuery: true, hasTrip: true, result: undefined })).toEqual({ kind: 'loading' });
    expect(serverExpenses({ canQuery: true, hasTrip: true, result })).toEqual({ complete: false, kind: 'loaded', rows: result.page });
  });
});
