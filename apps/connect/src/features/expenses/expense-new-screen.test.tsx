import { fireEvent, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import NewExpense from '@/app/expense-new';
import { renderWithTheme } from '@/test/render';

const tripA = { clientName: 'Client A', destination: 'Bali', id: 'jc_a', jobCode: 'JC-A', status: 'Confirmed', travelBatchCount: 1, travelEndDate: '2026-11-10', travelStartDate: '2026-11-04' };
const tripB = { ...tripA, clientName: 'Client B', id: 'jc_b', jobCode: 'JC-B' };
const mockTrips = { selected: tripA as typeof tripA | null, trips: [tripA, tripB] as (typeof tripA)[] };
const mockEnqueue = jest.fn();
const mockDeleteReceipt = jest.fn();
const mockBack = jest.fn();
const mockAllowLeave = jest.fn();
/** What the screen last asked of usePreventRemove: whether to guard, and what to do when it does. */
const mockGuard: { onBlocked?: (event: { repeat: () => void }) => void; prevent: boolean } = { prevent: false };

jest.mock('@/features/trips/trips-context', () => ({ useTrips: () => mockTrips }));
jest.mock('@/features/expenses/outbox-context', () => ({ useOutbox: () => ({ enqueue: mockEnqueue }) }));
jest.mock('@/features/gate/session', () => ({
  useStaff: () => ({ name: 'Test Tour Manager', roles: ['Tour Manager'], staffId: 'staff_1' }),
  useStaffSession: () => ({ gate: { kind: 'staff', offline: false }, online: true }),
}));
jest.mock('@/features/expenses/receipt-files', () => ({
  deleteReceipt: (...args: unknown[]) => mockDeleteReceipt(...args),
  keepReceipt: async () => ({ fileName: 'receipt.jpg', mimeType: 'image/jpeg', size: 10, uri: 'file:///cache/receipts/r.jpg' }),
}));
jest.mock('expo-image-picker', () => ({
  getPendingResultAsync: async () => null,
  launchImageLibraryAsync: async () => ({ assets: [{ uri: 'file:///picked.jpg' }], canceled: false }),
}));
jest.mock('expo-router', () => ({
  router: { back: () => mockBack() },
  usePreventRemove: (prevent: boolean, onBlocked: (event: { repeat: () => void }) => void) => {
    mockGuard.prevent = prevent;
    mockGuard.onBlocked = onBlocked;
    return mockAllowLeave;
  },
}));

async function fillForm() {
  await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));
  await screen.findByLabelText('Receipt photo');
  await fireEvent.changeText(screen.getByLabelText('Amount'), '120');
  await fireEvent.press(screen.getByRole('radio', { name: 'Transport' }));
}

function pressAlertButton(text: string) {
  const buttons = (jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
}

describe('new expense screen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockEnqueue.mockReset();
    mockDeleteReceipt.mockReset();
    mockBack.mockReset();
    mockAllowLeave.mockReset();
    mockGuard.prevent = true;
    mockGuard.onBlocked = undefined;
    mockTrips.selected = tripA;
    mockTrips.trips = [tripA, tripB];
  });

  it('starts on the trip shown on Today, as headcount does', async () => {
    await renderWithTheme(<NewExpense />);
    expect(screen.getByRole('radio', { name: 'JC-A · Client A' })).toBeChecked();
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ jobCardId: 'jc_a', staffId: 'staff_1' }));
  });

  it('files against another trip when the tour manager switches to it', async () => {
    await renderWithTheme(<NewExpense />);
    await fillForm();
    await fireEvent.press(screen.getByRole('radio', { name: 'JC-B · Client B' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ jobCardId: 'jc_b' }));
  });

  it('closes without asking while nothing is entered', async () => {
    await renderWithTheme(<NewExpense />);
    expect(mockGuard.prevent).toBe(false);
  });

  it('asks before closing over entered details, and removes the kept receipt on discard', async () => {
    await renderWithTheme(<NewExpense />);
    await fillForm();
    expect(mockGuard.prevent).toBe(true);

    const repeat = jest.fn();
    mockGuard.onBlocked?.({ repeat });
    expect(Alert.alert).toHaveBeenCalledWith('Discard this expense?', expect.stringContaining('receipt photo'), expect.any(Array));
    pressAlertButton('Keep editing');
    expect(repeat).not.toHaveBeenCalled();
    expect(mockDeleteReceipt).not.toHaveBeenCalled();

    pressAlertButton('Discard');
    expect(mockDeleteReceipt).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///cache/receipts/r.jpg' }));
    expect(repeat).toHaveBeenCalled();
  });

  it('closes straight after saving, keeping the receipt for the outbox', async () => {
    await renderWithTheme(<NewExpense />);
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(mockAllowLeave).toHaveBeenCalled();
    expect(mockAllowLeave.mock.invocationCallOrder[0]).toBeLessThan(mockBack.mock.invocationCallOrder[0] ?? 0);
    expect(mockDeleteReceipt).not.toHaveBeenCalled();
  });
});
