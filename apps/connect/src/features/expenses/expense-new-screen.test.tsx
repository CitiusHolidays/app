import { fireEvent, screen } from '@testing-library/react-native';

import NewExpense from '@/app/expense-new';
import { renderWithTheme } from '@/test/render';

const tripA = { clientName: 'Client A', destination: 'Bali', id: 'jc_a', jobCode: 'JC-A', status: 'Confirmed', travelBatchCount: 1, travelEndDate: '2026-11-10', travelStartDate: '2026-11-04' };
const tripB = { ...tripA, clientName: 'Client B', id: 'jc_b', jobCode: 'JC-B' };
const mockTrips = { chosen: null as typeof tripA | null, selected: tripA, trips: [tripA, tripB] };
const mockEnqueue = jest.fn();

jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => mockTrips }));
jest.mock('@/features/expenses/outbox-context', () => ({ useOutbox: () => ({ enqueue: mockEnqueue }) }));
jest.mock('@/features/gate/session', () => ({ useStaff: () => ({ name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' }) }));
jest.mock('@/features/expenses/receipt-files', () => ({
  keepReceipt: async () => ({ fileName: 'receipt.jpg', mimeType: 'image/jpeg', size: 10, uri: 'file:///cache/receipts/r.jpg' }),
}));
jest.mock('expo-image-picker', () => ({
  getPendingResultAsync: async () => null,
  launchImageLibraryAsync: async () => ({ assets: [{ uri: 'file:///picked.jpg' }], canceled: false }),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

async function fillForm() {
  await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));
  await screen.findByLabelText('Receipt photo');
  await fireEvent.changeText(screen.getByLabelText('Amount'), '120');
  await fireEvent.press(screen.getByRole('radio', { name: 'Transport' }));
}

describe('new expense screen', () => {
  beforeEach(() => {
    mockEnqueue.mockReset();
    mockTrips.chosen = null;
  });

  it('does not file against the default trip; the tour manager must pick one of their trips', async () => {
    await renderWithTheme(<NewExpense />);
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(screen.getByText('Choose the trip this expense is for.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'JC-B · Client B' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ jobCardId: 'jc_b', staffId: 'staff_1' }));
  });

  it('uses the trip the tour manager chose on Today', async () => {
    mockTrips.chosen = tripB;
    await renderWithTheme(<NewExpense />);
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ jobCardId: 'jc_b' }));
  });
});
