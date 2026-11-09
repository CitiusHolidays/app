import { act, render, screen, waitFor } from '@testing-library/react-native';
import { getFunctionName } from 'convex/server';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';

import { createOutboxItem, type OutboxItem, outboxKey } from './outbox';
import { OutboxProvider, useOutbox } from './outbox-context';

let mockStore: KeyValueStore;
const mockMutation = jest.fn();
const mockAction = jest.fn();

jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));
jest.mock('@/features/gate/session', () => ({
  useStaffSession: () => ({ gate: { kind: 'staff', offline: false, staff: { name: 'T', roles: ['Tour Manager'], staffId: 'staff_1' } }, online: true }),
}));
const mockConvex = { action: (...args: unknown[]) => mockAction(...args), mutation: (...args: unknown[]) => mockMutation(...args) };
jest.mock('convex/react', () => ({ useConvex: () => mockConvex }));
jest.mock('./receipt-files', () => ({ deleteReceipt: jest.fn(), uploadReceipt: async () => 'storage_1' }));

function expense(id: string) {
  return createOutboxItem({
    draft: { amount: 100, category: 'Transport', currency: 'THB', expenseDate: '2026-11-06', paidBy: 'T', particulars: `Taxi ${id}` },
    id,
    jobCardId: 'jc_1',
    now: Date.now(),
    receipt: { fileName: `${id}.jpg`, mimeType: 'image/jpeg', size: 2048, uri: `file:///receipts/${id}.jpg` },
    staffId: 'staff_1',
  });
}

const handles: { outbox: ReturnType<typeof useOutbox> | null } = { outbox: null };
function Probe() {
  const outbox = useOutbox();
  useEffect(() => {
    handles.outbox = outbox;
  });
  return <Text>{`items:${outbox.items.map((item) => `${item.id}=${item.status}`).join(',') || 'none'}`}</Text>;
}

async function renderApp() {
  return render(
    <AppStoreProvider fallback={null}>
      <OutboxProvider>
        <Probe />
      </OutboxProvider>
    </AppStoreProvider>
  );
}

const named = (mock: jest.Mock) => mock.mock.calls.map(([ref]) => getFunctionName(ref as Parameters<typeof getFunctionName>[0]));
const createdRefs = () =>
  mockMutation.mock.calls.filter(([ref]) => getFunctionName(ref as Parameters<typeof getFunctionName>[0]).endsWith('createExpense')).map(([, args]) => (args as { clientRef: string }).clientRef);

beforeEach(() => {
  mockStore = jest.requireActual('@/lib/storage/memory-store').createMemoryStore();
  mockMutation.mockReset();
  mockAction.mockReset();
  mockMutation.mockImplementation(async (ref: Parameters<typeof getFunctionName>[0], args: { clientRef?: string }) =>
    getFunctionName(ref).endsWith('createExpense') ? { id: `exp_${args.clientRef}` } : null
  );
  mockAction.mockImplementation(async (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref).endsWith('generateExpenseUploadUrl') ? 'https://upload.example/1' : null
  );
  handles.outbox = null;
});

describe('expense outbox provider', () => {
  it('sends an expense added while another is being sent as soon as that run ends', async () => {
    let releaseFirst: () => void = () => undefined;
    const firstCreate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    mockMutation.mockImplementationOnce(async () => {
      await firstCreate;
      return { id: 'exp_ob_1' };
    });
    await renderApp();
    await screen.findByText('items:none');
    await act(async () => handles.outbox?.enqueue(expense('ob_1')));
    await waitFor(() => expect(createdRefs()).toEqual(['ob_1']));

    // The tour manager files a second expense while the first is still on its way.
    await act(async () => handles.outbox?.enqueue(expense('ob_2')));
    expect(createdRefs()).toEqual(['ob_1']);
    await act(async () => releaseFirst());

    // No waiting for the 30-second timer, and the first expense is not filed again.
    expect(await screen.findByText('items:ob_1=done,ob_2=done')).toBeOnTheScreen();
    expect(createdRefs()).toEqual(['ob_1', 'ob_2']);
    expect(named(mockMutation).filter((name) => name.endsWith('submitExpenseForApproval'))).toHaveLength(2);
    expect((await mockStore.getJSON<OutboxItem[]>(outboxKey))?.map((item) => item.status)).toEqual(['done', 'done']);
  });

  it('sends a retried expense as soon as the run in progress ends', async () => {
    const refused = { ...expense('ob_1'), problem: 'No reporting manager is set for you.', status: 'needsAttention' as const };
    await mockStore.setJSON(outboxKey, [refused]);
    let releaseSecond: () => void = () => undefined;
    const secondCreate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    mockMutation.mockImplementationOnce(async () => {
      await secondCreate;
      return { id: 'exp_ob_2' };
    });
    await renderApp();
    expect(await screen.findByText('items:ob_1=needsAttention')).toBeOnTheScreen();
    await act(async () => handles.outbox?.enqueue(expense('ob_2')));
    await waitFor(() => expect(createdRefs()).toEqual(['ob_2']));

    await act(async () => handles.outbox?.retry('ob_1'));
    await act(async () => releaseSecond());
    expect(await screen.findByText('items:ob_1=done,ob_2=done')).toBeOnTheScreen();
    expect(createdRefs()).toEqual(['ob_2', 'ob_1']);
  });
});
