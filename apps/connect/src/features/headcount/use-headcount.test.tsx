import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AppStoreProvider } from '@/lib/app-store';
import type { KeyValueStore } from '@/lib/storage/kv';

import { headcountKey, startHeadcount, togglePresent } from './headcount';
import { useHeadcount } from './use-headcount';

let mockStore: KeyValueStore;
jest.mock('@/lib/storage/device-store', () => ({ openDeviceStore: async () => mockStore }));

const wrapper = ({ children }: { children: ReactNode }) => <AppStoreProvider fallback={null}>{children}</AppStoreProvider>;

describe('useHeadcount', () => {
  beforeEach(() => {
    mockStore = jest.requireActual('@/lib/storage/memory-store').createMemoryStore();
  });
  afterEach(() => jest.useRealTimers());

  it('saves nothing before today’s record is read, so a fresh start cannot overwrite it', async () => {
    const now = new Date(2026, 10, 6, 9, 0).getTime();
    jest.useFakeTimers({ advanceTimers: true, now });
    const key = headcountKey('jc_test_1', '2026-11-06');
    await mockStore.setJSON(key, togglePresent(startHeadcount('jc_test_1', now), 't_9', now));
    // The encrypted store is slow to answer for today's record.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const memory = mockStore;
    mockStore = { ...memory, getJSON: async (name) => (name === key ? gate.then(() => memory.getJSON(name)) : memory.getJSON(name)) } as KeyValueStore;

    const { result } = await renderHook(() => useHeadcount('jc_test_1'), { wrapper });
    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.loaded).toBe(false);
    expect(result.current.toggle('t_1')).toBeNull();
    expect(result.current.newStop('Lunch')).toBeNull();

    await act(async () => release());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.state?.stops).toHaveLength(1);
    expect(result.current.state?.stops[0]?.present).toEqual(['t_9']);
  });

  it('moves to a fresh day at midnight without the screen being reopened', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 6, 23, 59, 30) });
    const { result } = await renderHook(() => useHeadcount('jc_test_1'), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.state?.day).toBe('2026-11-06');
    await act(async () => result.current.toggle('t_1'));
    expect(result.current.state?.stops[0]?.present).toEqual(['t_1']);

    await act(async () => {
      jest.advanceTimersByTime(2 * 60_000);
    });
    await waitFor(() => expect(result.current.state?.day).toBe('2026-11-07'));
    expect(result.current.state?.stops[0]?.present).toEqual([]);
  });
});
